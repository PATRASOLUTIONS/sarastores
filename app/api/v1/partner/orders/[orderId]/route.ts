/**
 * Partner Order Details API
 * GET /api/v1/partner/orders/[orderId] - Get order details
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { getPartnerOrderById } from '@/lib/partner/orders';

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

/**
 * GET /api/v1/partner/orders/[orderId] - Get order details
 */
async function handleGet(req: PartnerAuthRequest, context: RouteParams) {
  try {
    const { orderId } = await context.params;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const order = await getPartnerOrderById(req.partner.id, orderId);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    console.error('[Partner Order Details API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// Export wrapped handler
export const GET = withPartnerAuth(handleGet as any, ['orders:read']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
