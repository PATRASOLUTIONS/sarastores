/**
 * Partner Order Cancel API
 * POST /api/v1/partner/orders/[orderId]/cancel - Cancel an order
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { cancelPartnerOrder } from '@/lib/partner/orders';

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

/**
 * POST /api/v1/partner/orders/[orderId]/cancel - Cancel an order
 */
async function handlePost(req: PartnerAuthRequest, context: RouteParams) {
  try {
    const { orderId } = await context.params;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Parse request body for cancellation reason
    let reason: string | undefined;
    try {
      const body = await req.json();
      reason = body.reason;
    } catch {
      // Body is optional
    }

    const result = await cancelPartnerOrder(req.partner.id, orderId, reason);

    if (!result.success) {
      const status = result.error === 'Order not found' ? 404 : 400;
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order: result.order,
        message: 'Order cancelled successfully',
      },
    });
  } catch (error) {
    console.error('[Partner Order Cancel API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}

// Export wrapped handler
export const POST = withPartnerAuth(handlePost as any, ['orders:write']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
