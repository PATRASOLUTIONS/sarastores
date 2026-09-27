/**
 * Admin Partner Wallet API
 * 
 * GET /api/admin/partners/[partnerId]/wallet - Get wallet details
 * POST /api/admin/partners/[partnerId]/wallet - Add funds to wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuthorization } from '@/lib/auth';
import { 
  getWalletByPartnerId, 
  createTransaction, 
  getWalletTransactions 
} from '@/lib/partner/wallet';
import { getPartnerById } from '@/lib/partner/service';

/**
 * GET /api/admin/partners/[partnerId]/wallet
 * Get wallet details and transactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }

  try {
    const { partnerId } = await params;
    
    // Get partner to verify existence
    const partner = await getPartnerById(partnerId);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }

    // Get wallet
    const wallet = await getWalletByPartnerId(partnerId);
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } },
        { status: 404 }
      );
    }

    // Get transactions
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const transactions = await getWalletTransactions(wallet.id, { page, limit });

    return NextResponse.json({
      success: true,
      data: {
        wallet: {
          id: wallet.id,
          partnerId: wallet.partnerId,
          balance: wallet.balance,
          currency: wallet.currency,
          bankAccounts: wallet.bankAccounts,
          minimumPayout: wallet.minimumPayout,
          autoPayout: wallet.autoPayout,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        },
        transactions: transactions.transactions,
        pagination: {
          page,
          limit,
          total: transactions.total,
          totalPages: Math.ceil(transactions.total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Admin Partner Wallet] Get error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get wallet' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/partners/[partnerId]/wallet
 * Add funds to wallet (test mode or with payment proof)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }

  try {
    const { partnerId } = await params;
    const body = await request.json();
    
    const { 
      amount, 
      mode, // 'test' | 'prod'
      description,
      paymentReference,
      paymentProof, // URL or base64 image
      notes 
    } = body;

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid amount is required' } },
        { status: 400 }
      );
    }

    // In prod mode, payment reference is required
    if (mode === 'prod' && !paymentReference) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Payment reference is required in production mode' } },
        { status: 400 }
      );
    }

    // Get partner
    const partner = await getPartnerById(partnerId);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }

    // Get wallet
    const wallet = await getWalletByPartnerId(partnerId);
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } },
        { status: 404 }
      );
    }

    // Create transaction description
    const transactionDescription = mode === 'test' 
      ? `[TEST] Admin credited: ${description || 'Test funds added'}`
      : `Admin credited: ${description || 'Funds added'} (Ref: ${paymentReference})`;

    // Create the credit transaction
    const transaction = await createTransaction(
      wallet.id,
      partnerId,
      'credit',
      'bonus', // Using bonus category for admin-added funds
      amount,
      transactionDescription,
      {
        notes: mode === 'test' 
          ? `Test mode - No payment proof required. ${notes || ''}`
          : `Payment Reference: ${paymentReference}. ${paymentProof ? 'Payment proof attached.' : ''} ${notes || ''}`,
        environment: mode === 'test' ? 'test' : 'live',
        paymentReference: paymentReference || undefined,
      }
    );

    // Get updated wallet
    const updatedWallet = await getWalletByPartnerId(partnerId);

    return NextResponse.json({
      success: true,
      data: {
        transaction: {
          id: transaction.id,
          type: transaction.type,
          category: transaction.category,
          environment: transaction.environment,
          amount: transaction.amount,
          balanceAfter: transaction.balanceAfter,
          description: transaction.description,
          paymentReference: transaction.paymentReference,
          status: transaction.status,
          createdAt: transaction.createdAt,
        },
        wallet: {
          id: updatedWallet?.id,
          balance: updatedWallet?.balance,
        },
      },
      message: `Successfully added ₹${amount.toLocaleString()} to wallet`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Partner Wallet] Add funds error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add funds' } },
      { status: 500 }
    );
  }
}
