/**
 * Admin Payout Reject API
 * 
 * POST /api/admin/payouts/[payoutId]/reject - Reject payout request
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';
import { rejectPayout } from '@/lib/partner/wallet';
import { getCollection } from '@/lib/db-service';

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
    const body = await request.json();
    
    // Validate reason is provided
    if (!body.reason) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason is required' } },
        { status: 400 }
      );
    }
    
    // Find payout
    const collection = await getCollection(PAYOUTS_COLLECTION);
    let payout;
    try {
      payout = await collection.findOne({ _id: new ObjectId(payoutId) });
    } catch (e) {
      payout = await collection.findOne({ id: payoutId });
    }
    
    if (!payout) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payout not found' } },
        { status: 404 }
      );
    }
    
    // Reject payout
    const result = await rejectPayout(
      payout._id?.toString() || payout.id,
      body.reason,
      authCheck.userId!
    );
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: 'REJECTION_FAILED', message: 'Failed to reject payout' } },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        payoutId: payout._id?.toString() || payout.id,
        status: 'rejected',
        rejectionReason: body.reason,
        message: 'Payout rejected. Funds have been returned to partner wallet.',
      },
    });
  } catch (error) {
    console.error('[Admin Payout Reject] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reject payout' } },
      { status: 500 }
    );
  }
}
