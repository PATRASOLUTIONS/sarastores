/**
 * Admin Payouts API
 * 
 * GET /api/admin/payouts - List all payouts with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';
import { getCollection } from '@/lib/db-service';

const PAYOUTS_COLLECTION = 'partner_payouts';
const PARTNERS_COLLECTION = 'partners';

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
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');
    const partnerId = searchParams.get('partnerId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    const collection = await getCollection(PAYOUTS_COLLECTION);
    const partnersCollection = await getCollection(PARTNERS_COLLECTION);
    
    // Build filter
    const filter: any = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (partnerId) {
      filter.partnerId = partnerId;
    }
    
    if (dateFrom || dateTo) {
      filter.requestedAt = {};
      if (dateFrom) filter.requestedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.requestedAt.$lte = new Date(dateTo);
    }
    
    // Fetch payouts with partner info
    const [payouts, total] = await Promise.all([
      collection
        .aggregate([
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
                    $expr: { $eq: [{ $toString: '$_id' }, '$$partnerId'] }
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
    const payoutList = payouts.map((payout: any) => ({
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
    const pendingStats = await collection.aggregate([
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
