/**
 * Partner Wallet Balance API
 * GET /api/v1/partner/wallet/balance - Get wallet balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { getWalletByPartnerId } from '@/lib/partner/wallet';

/**
 * GET /api/v1/partner/wallet/balance - Get wallet balance
 */
async function handleGet(req: PartnerAuthRequest) {
  try {
    const wallet = await getWalletByPartnerId(req.partner.id);

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        walletId: wallet.id,
        balance: {
          available: wallet.balance.available,
          pending: wallet.balance.pending,
          held: wallet.balance.held,
          total: wallet.balance.available + wallet.balance.pending + wallet.balance.held,
        },
        currency: wallet.currency,
        minimumPayout: wallet.minimumPayout,
        autoPayout: wallet.autoPayout,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Partner Wallet Balance API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wallet balance' },
      { status: 500 }
    );
  }
}

// Export wrapped handler
export const GET = withPartnerAuth(handleGet as any, ['wallet:read']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
