/**
 * Partner Payouts History API
 * 
 * GET /api/v1/partner/wallet/payouts - List payout history
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { getPartnerPayouts } from '@/lib/partner/wallet';

/**
 * GET /api/v1/partner/wallet/payouts
 * List payout history
 */
async function handleGet(req: PartnerAuthRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Validate status if provided
    const validStatuses = ['pending_approval', 'approved', 'processing', 'completed', 'failed', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await getPartnerPayouts(req.partner.id, {
      status: status || undefined,
      page: Math.max(1, page),
      limit: Math.min(Math.max(1, limit), 100),
    });

    return NextResponse.json({
      success: true,
      data: {
        payouts: result.payouts.map(payout => ({
          id: payout.id,
          amount: payout.amount,
          status: payout.status,
          bankAccount: payout.bankAccount,
          requestedAt: payout.requestedAt,
          approvedAt: payout.approvedAt,
          completedAt: payout.completedAt,
          rejectedAt: payout.rejectedAt,
          notes: payout.notes,
        })),
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Partner Payouts History] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payouts' },
      { status: 500 }
    );
  }
}

// Export wrapped handler
export const GET = withPartnerAuth(handleGet as any, ['wallet:read']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
