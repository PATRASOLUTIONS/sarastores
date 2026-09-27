import { NextRequest, NextResponse } from 'next/server'
import { getCollection, createObjectId } from '@/lib/db-service'
import { requireAdmin } from '@/lib/auth'

/**
 * POST /api/admin/partners/orders/[orderId]/verify-payment
 * Mark a partner order's payment as verified by admin
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { orderId } = await params

        if (!orderId) {
            return NextResponse.json(
                { success: false, error: 'Order ID is required' },
                { status: 400 }
            )
        }

        let body = {}
        try {
            body = await request.json()
        } catch (e) {
            // Default to empty object if no body or invalid JSON
        }
        const adminName = (body as any).verifiedBy || 'Admin'

        const collection = await getCollection('partner_orders')

        // Find the order first
        let query: any = { orderId: orderId }
        try {
            const objId = createObjectId(orderId)
            query = { $or: [{ orderId: orderId }, { _id: objId }] }
        } catch (e) {
            // Not an ObjectId, keep query as is
        }

        const order = await collection.findOne(query)

        if (!order) {
            return NextResponse.json(
                { success: false, error: 'Partner order not found' },
                { status: 404 }
            )
        }

        // Update the payment verification
        const result = await collection.updateOne(
            { _id: order._id },
            {
                $set: {
                    'paymentVerification.verified': true,
                    'paymentVerification.verifiedAt': new Date(),
                    'paymentVerification.verifiedBy': adminName,
                    updatedAt: new Date(),
                },
            }
        )

        if (result.modifiedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'Failed to update verification status' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                orderId,
                paymentVerified: true,
                verifiedAt: new Date().toISOString(),
                verifiedBy: adminName,
            },
        })
    } catch (error) {
        console.error('[Verify Payment] Error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to verify payment' },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/admin/partners/orders/[orderId]/verify-payment
 * Revert payment verification (un-verify)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { orderId } = await params

        if (!orderId) {
            return NextResponse.json(
                { success: false, error: 'Order ID is required' },
                { status: 400 }
            )
        }

        const collection = await getCollection('partner_orders')

        let query: any = { orderId: orderId }
        try {
            const objId = createObjectId(orderId)
            query = { $or: [{ orderId: orderId }, { _id: objId }] }
        } catch (e) {
            // Not an ObjectId
        }

        const order = await collection.findOne(query)

        if (!order) {
            return NextResponse.json(
                { success: false, error: 'Partner order not found' },
                { status: 404 }
            )
        }

        const result = await collection.updateOne(
            { _id: order._id },
            {
                $set: {
                    'paymentVerification.verified': false,
                    updatedAt: new Date(),
                },
                $unset: {
                    'paymentVerification.verifiedAt': '',
                    'paymentVerification.verifiedBy': '',
                },
            }
        )

        if (result.modifiedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'Failed to revert verification status' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            data: {
                orderId,
                paymentVerified: false,
            },
        })
    } catch (error) {
        console.error('[Verify Payment] Revert error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to revert payment verification' },
            { status: 500 }
        )
    }
}
