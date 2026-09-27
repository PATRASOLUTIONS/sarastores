/**
 * Partner Order Status API
 * GET /api/v1/partner/orders/status/[id] - Get order status by internal or external ID
 */

import { NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { getPartnerOrderByIdOrExternalId } from '@/lib/partner/orders';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/partner/orders/status/[id] - Get order status and tracking details
 */
async function handleGet(req: PartnerAuthRequest, context: RouteParams) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Order ID or External ID is required' },
                { status: 400 }
            );
        }

        const order = await getPartnerOrderByIdOrExternalId(req.partner.id, id);

        if (!order) {
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404 }
            );
        }

        // Return a streamlined status response
        return NextResponse.json({
            success: true,
            data: {
                orderId: order.orderId,
                partnerOrderId: order.partnerOrderId,
                status: order.status,
                statusHistory: order.statusHistory,
                tracking: order.tracking || null,
                shipmentNumber: order.tracking?.trackingNumber || null,
                paymentStatus: order.paymentVerification?.verified ? 'verified' : 'pending',
                summary: {
                    total: order.summary.total,
                    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
                },
                updatedAt: order.updatedAt,
            },
        });
    } catch (error) {
        console.error('[Partner Order Status API] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch order status' },
            { status: 500 }
        );
    }
}

// Export wrapped handler
export const GET = withPartnerAuth(handleGet as any, ['orders:read']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
