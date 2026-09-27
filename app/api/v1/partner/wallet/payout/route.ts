/**
 * Partner Payout Request API
 * 
 * POST /api/v1/partner/wallet/payout - Request a payout
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { createPayoutRequest, getWalletByPartnerId } from '@/lib/partner/wallet';

/**
 * POST /api/v1/partner/wallet/payout
 * Request a payout
 */
async function handlePost(req: PartnerAuthRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.amount || typeof body.amount !== 'number') {
      return NextResponse.json(
        { success: false, error: 'amount is required and must be a number' },
        { status: 400 }
      );
    }

    if (!body.bankAccountId) {
      return NextResponse.json(
        { success: false, error: 'bankAccountId is required' },
        { status: 400 }
      );
    }

    // Get wallet
    const wallet = await getWalletByPartnerId(req.partner.id);

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Check minimum payout
    const minPayout = wallet.minimumPayout || 1000;
    if (body.amount < minPayout) {
      return NextResponse.json(
        { success: false, error: `Minimum payout amount is ₹${minPayout}` },
        { status: 400 }
      );
    }

    // Check available balance
    if (body.amount > wallet.balance.available) {
      return NextResponse.json(
        { success: false, error: `Insufficient balance. Available: ₹${wallet.balance.available}` },
        { status: 400 }
      );
    }

    // Verify bank account exists
    const bankAccount = wallet.bankAccounts?.find(acc => acc.id === body.bankAccountId);

    if (!bankAccount) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      );
    }

    // Create payout request
    const payout = await createPayoutRequest(
      req.partner.id,
      wallet.id,
      body.amount,
      body.bankAccountId,
      body.notes
    );

    return NextResponse.json({
      success: true,
      data: {
        payoutId: payout.id,
        amount: payout.amount,
        status: payout.status,
        bankAccount: {
          accountNumber: `XXXX${bankAccount.accountNumber.slice(-4)}`,
          bankName: bankAccount.bankName,
          ifsc: bankAccount.ifsc,
        },
        estimatedArrival: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        requestedAt: payout.requestedAt,
        message: 'Payout request submitted successfully. Processing time: 1-3 business days.',
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Partner Payout Request] Error:', error);
    
    // Return specific error message if available
    const message = error?.message || 'Failed to create payout request';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

// Export wrapped handler
export const POST = withPartnerAuth(handlePost as any, ['wallet:write']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
