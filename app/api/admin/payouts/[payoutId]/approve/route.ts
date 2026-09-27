/**
 * Admin Payout Approve API
 * 
 * POST /api/admin/payouts/[payoutId]/approve - Approve and process payout
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';
import { approvePayout } from '@/lib/partner/wallet';
import { getCollection } from '@/lib/db-service';

const PAYOUTS_COLLECTION = 'partner_payouts';

/**
 * POST /api/admin/payouts/[payoutId]/approve
 * Approve and process payout
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
    
    // Parse optional transaction details
    let transactionId: string | undefined;
    let notes: string | undefined;
    
    try {
      const body = await request.json();
      transactionId = body.transactionId;
      notes = body.notes;
    } catch (e) {
      // No body provided
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
    
    // Approve payout
    const result = await approvePayout(
      payout._id?.toString() || payout.id,
      authCheck.userId!
    );
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: 'APPROVAL_FAILED', message: 'Failed to approve payout' } },
        { status: 400 }
      );
    }
    
    // Update notes and transactionId if provided
    if (notes || transactionId) {
      const updateData: any = { updatedAt: new Date() };
      if (notes) updateData.adminNotes = notes;
      if (transactionId) updateData.transactionId = transactionId;
      await collection.updateOne(
        { _id: payout._id },
        { $set: updateData }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        payoutId: payout._id?.toString() || payout.id,
        status: 'approved',
        message: 'Payout approved and processed successfully',
      },
    });
  } catch (error) {
    console.error('[Admin Payout Approve] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve payout' } },
      { status: 500 }
    );
  }
}
