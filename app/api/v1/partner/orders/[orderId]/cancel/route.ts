/**
 * Partner Order Cancel API
 * POST /api/v1/partner/orders/[orderId]/cancel - Cancel an order
 */

import { NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { cancelPartnerOrder } from '@/lib/partner/orders';
import { PartnerOrderCancelSchema } from '@/lib/validation';

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

    const text = await req.text();
    let body: unknown = {};
    try {
      if (text.trim()) body = JSON.parse(text);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = PartnerOrderCancelSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid cancellation reason' }, { status: 400 });
    const result = await cancelPartnerOrder(req.partner.id, orderId, req.apiKey.environment, parsed.data.reason);

    if (!result.success) {
      const status = result.status || 400;
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
export const POST = withPartnerAuth(handlePost, ['orders:write']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
