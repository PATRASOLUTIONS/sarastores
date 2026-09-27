/**
 * Partner Wallet Transactions API
 * GET /api/v1/partner/wallet/transactions - Get wallet transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { getWalletByPartnerId, getWalletTransactions } from '@/lib/partner/wallet';
import { TransactionType, TransactionCategory } from '@/lib/partner/types';

/**
 * GET /api/v1/partner/wallet/transactions - Get wallet transactions
 */
async function handleGet(req: PartnerAuthRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Get partner's wallet
    const wallet = await getWalletByPartnerId(req.partner.id);
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const type = searchParams.get('type') as TransactionType | null;
    const category = searchParams.get('category') as TransactionCategory | null;
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Validate type if provided
    const validTypes: TransactionType[] = ['credit', 'debit', 'hold', 'release'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Valid values: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate category if provided
    const validCategories: TransactionCategory[] = [
      'order_commission',
      'payout',
      'refund_adjustment',
      'bonus',
      'penalty',
      'refund_hold',
      'dispute_hold',
      'hold_release',
    ];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Valid values: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await getWalletTransactions(wallet.id, {
      type: type || undefined,
      category: category || undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: Math.max(1, page),
      limit: Math.min(Math.max(1, limit), 100),
    });

    return NextResponse.json({
      success: true,
      data: {
        transactions: result.transactions,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Partner Wallet Transactions API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// Export wrapped handler
export const GET = withPartnerAuth(handleGet as any, ['wallet:read']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
