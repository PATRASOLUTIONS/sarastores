/**
 * POST /api/admin/partner-commissions/mark-paid
 * Admin marks one or more partner order commissions as paid (credited).
 *
 * Body:
 *   partnerId     - the partner's ID
 *   orderIds      - array of orderId strings (the PO-xxx internal IDs or _id strings)
 *   transactionId - optional bank/UPI transaction reference
 *   notes         - optional admin notes
 *   totalAmount   - total amount being paid (for payout record)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuthorization } from '@/lib/auth'
import { getCollection } from '@/lib/db-service'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAuthorization()
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { partnerId, orderIds, transactionId, notes, totalAmount } = body

  if (!partnerId || !Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'partnerId and orderIds[] are required' } },
      { status: 400 }
    )
  }

  try {
    const ordersCol = await getCollection('partner_orders')
    const payoutsCol = await getCollection('partner_payouts')
    const txnCol = await getCollection('wallet_transactions')
    const walletsCol = await getCollection('partner_wallets')

    const now = new Date()

    // Update commission.status → 'credited' for each matching order
    // Orders may be matched by orderId (PO-xxx) OR _id string
    const updateResults: string[] = []
    const failedIds: string[] = []

    for (const oid of orderIds) {
      // Try matching by orderId field first, then by _id
      let result = await ordersCol.updateOne(
        { partnerId, orderId: oid, 'commission.status': 'pending' },
        {
          $set: {
            'commission.status': 'credited',
            'commission.creditedAt': now,
            'commission.creditedBy': 'admin',
            'commission.transactionId': transactionId || null,
            updatedAt: now,
          },
        }
      )

      if (result.matchedCount === 0) {
        // Try by _id
        try {
          result = await ordersCol.updateOne(
            { partnerId, _id: new ObjectId(oid), 'commission.status': 'pending' },
            {
              $set: {
                'commission.status': 'credited',
                'commission.creditedAt': now,
                'commission.creditedBy': 'admin',
                'commission.transactionId': transactionId || null,
                updatedAt: now,
              },
            }
          )
        } catch {
          // Not a valid ObjectId, skip
        }
      }

      if (result.modifiedCount > 0) {
        updateResults.push(oid)
      } else {
        failedIds.push(oid)
      }
    }

    if (updateResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No pending orders were updated. They may already be credited.' },
      }, { status: 404 })
    }

    // Create a completed payout record for audit trail
    const payoutRecord: any = {
      partnerId,
      amount: totalAmount || 0,
      status: 'completed',
      source: 'admin_direct', // admin initiated, not partner-requested
      orderIds: updateResults,
      transactionId: transactionId || null,
      notes: notes || null,
      adminNotes: `Admin marked ${updateResults.length} order commission(s) as paid`,
      requestedAt: now,
      approvedAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    const payoutInsert = await payoutsCol.insertOne(payoutRecord)

    // Create wallet transaction for audit trail
    const wallet = await walletsCol.findOne({ partnerId })
    if (wallet) {
      await txnCol.insertOne({
        walletId: wallet._id?.toString() || wallet.id,
        partnerId,
        type: 'credit',
        category: 'order_commission',
        amount: totalAmount || 0,
        description: `Commission paid by admin for ${updateResults.length} order(s)`,
        paymentReference: transactionId || null,
        notes: notes || null,
        status: 'completed',
        processedBy: 'admin',
        orderIds: updateResults,
        payoutId: payoutInsert.insertedId?.toString(),
        environment: 'live',
        createdAt: now,
        processedAt: now,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: updateResults.length,
        failed: failedIds.length,
        failedIds,
        payoutId: payoutInsert.insertedId?.toString(),
      },
    })
  } catch (error) {
    console.error('[Admin Partner Commissions] mark-paid error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark commissions as paid' } },
      { status: 500 }
    )
  }
}
