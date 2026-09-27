/**
 * Admin Payout Details API
 * 
 * GET /api/admin/payouts/[payoutId] - Get payout details
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';
import { getCollection } from '@/lib/db-service';
import { getPartnerById } from '@/lib/partner/service';
import { getWalletByPartnerId } from '@/lib/partner/wallet';

const PAYOUTS_COLLECTION = 'partner_payouts';

/**
 * GET /api/admin/payouts/[payoutId]
 * Get payout details
 */
export async function GET(
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
    
    const collection = await getCollection(PAYOUTS_COLLECTION);
    
    // Find payout
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
    
    // Get partner info
    const partner = await getPartnerById(payout.partnerId);
    
    // Get wallet info
    const wallet = payout.partnerId ? await getWalletByPartnerId(payout.partnerId) : null;
    
    const responseData = {
      payout: {
        id: payout._id?.toString() || payout.id,
        payoutId: payout.payoutId || payout.id,
        partnerId: payout.partnerId,
        amount: payout.amount,
        bankAccount: payout.bankAccount,
        status: payout.status,
        notes: payout.notes,
        adminNotes: payout.adminNotes,
        transactionId: payout.transactionId,
        requestedAt: payout.requestedAt,
        approvedAt: payout.approvedAt,
        approvedBy: payout.approvedBy,
        processedAt: payout.processedAt,
        completedAt: payout.completedAt,
        rejectedAt: payout.rejectedAt,
        rejectedBy: payout.rejectedBy,
        rejectionReason: payout.rejectionReason,
      },
      partner: partner ? {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        gstin: partner.businessDetails?.gstin,
        tier: partner.tier,
        status: partner.status,
      } : null,
      walletBalance: wallet ? {
        available: wallet.balance?.available || 0,
        pending: wallet.balance?.pending || 0,
        held: wallet.balance?.held || 0,
      } : null,
    };
    
    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[Admin Payout Details] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get payout details' } },
      { status: 500 }
    );
  }
}
