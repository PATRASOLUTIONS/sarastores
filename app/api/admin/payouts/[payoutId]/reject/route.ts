/**
 * Admin Payout Reject API
 * 
 * POST /api/admin/payouts/[payoutId]/reject - Reject payout request
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';
import { rejectPayout, PayoutStateConflictError } from '@/lib/partner/wallet';
import { getCollection } from '@/lib/db-service';
import type { Payout } from '@/lib/partner/types';
import { z } from 'zod';

const PAYOUTS_COLLECTION = 'partner_payouts';

/**
 * POST /api/admin/payouts/[payoutId]/reject
 * Reject payout request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }
  
  try {
    const { payoutId } = await params;
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, { status: 400 }
      );
    }
    const parsed = z.object({ reason: z.string().trim().min(1).max(2000) }).strict().safeParse(body);
    if (!parsed.success || !payoutId || payoutId.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason is required' } },
        { status: 400 }
      );
    }
    
    // Find payout
    const collection = await getCollection<Payout>(PAYOUTS_COLLECTION);
    const payout = (ObjectId.isValid(payoutId)
      ? await collection.findOne({ _id: new ObjectId(payoutId) }) : null)
      ?? await collection.findOne({ id: payoutId });
    
    if (!payout) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payout not found' } },
        { status: 404 }
      );
    }
    
    if (!authCheck.userId) throw new Error('Authenticated operator identity is missing');
    const result = await rejectPayout(
      payout._id.toString(),
      authCheck.userId,
      parsed.data.reason
    );
    
    return NextResponse.json({
      success: true,
      data: {
        payoutId: result.id,
        status: result.status,
        rejectionReason: result.rejectionReason,
        message: 'Payout rejected. Funds have been returned to partner wallet.',
      },
    });
  } catch (error) {
    if (error instanceof PayoutStateConflictError) return NextResponse.json(
      { success: false, error: { code: 'CONFLICT', message: 'Payout is no longer pending approval' } }, { status: 409 }
    );
    console.error('[Admin Payout Reject] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reject payout' } },
      { status: 500 }
    );
  }
}
