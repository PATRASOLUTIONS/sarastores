import { NextRequest, NextResponse } from 'next/server'
import { getCollection, normalizeId } from '@/lib/db-service'
import { requireAdmin } from '@/lib/auth'

/**
 * GET /api/admin/partners/[partnerId]/orders
 * Fetch all orders for a specific partner from the partner_orders collection
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ partnerId: string }> }
) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { partnerId } = await params

        if (!partnerId) {
            return NextResponse.json(
                { success: false, error: 'Partner ID is required' },
                { status: 400 }
            )
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const page = parseInt(searchParams.get('page') || '1', 10)
        const limit = parseInt(searchParams.get('limit') || '50', 10)

        const collection = await getCollection('partner_orders')

        // Build query
        const query: any = { partnerId }
        if (status) {
            query.status = status
        }

        // Get total count
        const total = await collection.countDocuments(query)

        // Fetch orders with pagination
        const orders = await collection
            .find(query)
            .sort({ createdAt: -1 })
            .skip((Math.max(1, page) - 1) * Math.min(limit, 100))
            .limit(Math.min(limit, 100))
            .toArray()

        // Normalize orders
        const normalizedOrders = orders.map((order: any) => ({
            id: order._id?.toString(),
            orderId: order.orderId,
            partnerId: order.partnerId,
            partnerOrderId: order.partnerOrderId || null,
            customer: order.customer || {},
            items: (order.items || []).map((item: any) => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                sku: item.sku || null,
            })),
            summary: order.summary || { subtotal: 0, tax: 0, shipping: 0, total: 0 },
            paymentMethod: order.paymentMethod || 'unknown',
            status: order.status || 'pending',
            statusHistory: order.statusHistory || [],
            commission: order.commission || null,
            tracking: order.tracking || null,
            notes: order.notes || null,
            paymentDetails: order.paymentDetails || null,
            paymentVerification: order.paymentVerification || { verified: false },
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        }))

        return NextResponse.json({
            success: true,
            data: {
                orders: normalizedOrders,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        })
    } catch (error) {
        console.error('[Admin Partner Orders] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch partner orders' },
            { status: 500 }
        )
    }
}
