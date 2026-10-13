/**
 * Admin Payouts API
 * 
 * GET /api/admin/payouts - List all payouts with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Filter, WithId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';
import { getCollection } from '@/lib/db-service';
import { PAYOUT_STATUSES, type Partner, type Payout } from '@/lib/partner/types';
import { z } from 'zod';

const PAYOUTS_COLLECTION = 'partner_payouts';
const PARTNERS_COLLECTION = 'partners';
const querySchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(100000)).default('1'),
  limit: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(100)).default('20'),
  status: z.enum(PAYOUT_STATUSES).optional(),
  partnerId: z.string().min(1).max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
}).refine(value => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo);
type ListedPayout = WithId<Payout> & { payoutId?: string; partner?: WithId<Partner> };

/**
 * GET /api/admin/payouts
 * List all payouts with filters
 */
export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }
  
  try {
    const { searchParams } = new URL(request.url);
    
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid payout filters' } }, { status: 400 }
    );
    const { page, limit, status, partnerId, dateFrom, dateTo } = parsed.data;
    const skip = (page - 1) * limit;
    
    const collection = await getCollection<Payout>(PAYOUTS_COLLECTION);
    
    // Build filter
    const filter: Filter<Payout> = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (partnerId) {
      filter.partnerId = partnerId;
    }
    
    if (dateFrom || dateTo) {
      filter.requestedAt = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lte: dateTo } : {}),
      };
    }
    
    // Fetch payouts with partner info
    const [payouts, total] = await Promise.all([
      collection
        .aggregate<ListedPayout>([
          { $match: filter },
          { $sort: { requestedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: PARTNERS_COLLECTION,
              let: { partnerId: '$partnerId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $or: [
                      { $eq: [{ $toString: '$_id' }, '$$partnerId'] },
                      { $eq: ['$id', '$$partnerId'] },
                    ] }
                  }
                }
              ],
              as: 'partner',
            },
          },
          { $unwind: { path: '$partner', preserveNullAndEmptyArrays: true } },
        ])
        .toArray(),
      collection.countDocuments(filter),
    ]);
    
    // Transform payouts for response
    const payoutList = payouts.map((payout) => ({
      id: payout._id?.toString() || payout.id,
      payoutId: payout.payoutId || payout.id,
      partner: payout.partner ? {
        id: payout.partner._id?.toString() || payout.partner.id,
        name: payout.partner.name,
        email: payout.partner.email,
      } : null,
      amount: payout.amount,
      bankAccount: payout.bankAccount,
      status: payout.status,
      requestedAt: payout.requestedAt,
      processedAt: payout.processedAt,
      completedAt: payout.completedAt,
      rejectedAt: payout.rejectedAt,
      rejectionReason: payout.rejectionReason,
    }));
    
    // Get summary stats
    const pendingStats = await collection.aggregate<{ count: number; totalAmount: number }>([
      { $match: { status: 'pending_approval' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]).toArray();
    
    return NextResponse.json({
      success: true,
      data: {
        payouts: payoutList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          pendingCount: pendingStats[0]?.count || 0,
          pendingAmount: pendingStats[0]?.totalAmount || 0,
        },
      },
    });
  } catch (error) {
    console.error('[Admin Payouts] List error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list payouts' } },
      { status: 500 }
    );
  }
}
