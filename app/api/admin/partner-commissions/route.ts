/**
 * GET /api/admin/partner-commissions
 * Returns all partner orders grouped by partner with commission breakdown.
 * Query params:
 *   partnerId   - filter to a specific partner
 *   status      - 'pending' | 'credited' | 'adjusted' | 'all' (default: all)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuthorization } from '@/lib/auth'
import { getCollection } from '@/lib/db-service'
import { ObjectId, type Filter, type WithId } from 'mongodb'
import type { Partner, PartnerOrder } from '@/lib/partner/types'
import { z } from 'zod'
import { isCommissionPaymentEligible } from '@/lib/partner/commissions'

const querySchema = z.object({
  partnerId: z.string().min(1).max(100).optional(),
  status: z.enum(['pending', 'credited', 'adjusted', 'all']).default('all'),
})

function commissionOrder(order: WithId<PartnerOrder>) {
  return {
    orderId: order._id.toString(),
    internalOrderId: order.orderId,
    partnerOrderId: order.partnerOrderId || null,
    createdAt: order.createdAt,
    orderTotal: order.summary?.total || 0,
    subtotal: order.summary?.subtotal || 0,
    commissionRate: order.commission?.rate || 0,
    commissionAmount: order.commission?.amount || 0,
    commissionStatus: order.commission?.status || 'pending',
    paymentVerified: order.paymentVerification?.verified === true,
    paymentEligible: isCommissionPaymentEligible(order),
    orderStatus: order.status || 'pending',
    customer: { name: order.customer?.name || '', email: order.customer?.email || '' },
    items: (order.items || []).map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
  }
}

export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAuthorization()
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid commission filters' } }, { status: 400 }
    )
    const { partnerId: partnerIdFilter, status: statusFilter } = parsed.data

    const ordersCol = await getCollection<PartnerOrder>('partner_orders')
    const partnersCol = await getCollection<Partner>('partners')

    // Build match stage
    const match: Filter<PartnerOrder> = {}
    if (partnerIdFilter) match.partnerId = partnerIdFilter
    if (statusFilter && statusFilter !== 'all') match['commission.status'] = statusFilter

    const orders = await ordersCol
      .find(match)
      .sort({ createdAt: -1 })
      .toArray()

    // Collect unique partnerIds
    const partnerIds = [...new Set(orders.map((o) => o.partnerId).filter(Boolean))]

    const nativeIds = partnerIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
    const partners = partnerIds.length > 0
      ? await partnersCol.find({ $or: [{ id: { $in: partnerIds } }, { _id: { $in: nativeIds } }] }).toArray()
      : []

    const partnerMap = new Map<string, WithId<Partner>>()
    for (const p of partners) {
      partnerMap.set(p._id.toString(), p)
      if (p.id) partnerMap.set(p.id, p)
    }

    // Group orders by partnerId
    const grouped: Record<string, {
      partnerId: string
      partnerName: string
      partnerEmail: string
      tier: string
      commissionRate: number
      totalPending: number
      totalCredited: number
      orders: ReturnType<typeof commissionOrder>[]
    }> = {}

    for (const order of orders) {
      const pid = order.partnerId
      if (!pid) continue

      if (!grouped[pid]) {
        const partner = partnerMap.get(pid)
        grouped[pid] = {
          partnerId: pid,
          partnerName: partner?.name || partner?.email || pid,
          partnerEmail: partner?.email || '',
          tier: partner?.tier || 'starter',
          commissionRate: order.commission?.rate ?? partner?.commissionRate ?? 0,
          totalPending: 0,
          totalCredited: 0,
          orders: [],
        }
      }

      const commAmt = order.commission?.amount || 0
      const commStatus = order.commission?.status || 'pending'

      if (commStatus === 'pending') grouped[pid].totalPending += commAmt
      else if (commStatus === 'credited') grouped[pid].totalCredited += commAmt

      grouped[pid].orders.push(commissionOrder(order))
    }

    const result = Object.values(grouped).sort((a, b) => b.totalPending - a.totalPending)

    // Global summary
    const totalPendingAll = result.reduce((s, p) => s + p.totalPending, 0)
    const totalCreditedAll = result.reduce((s, p) => s + p.totalCredited, 0)
    const partnersWithPending = result.filter(p => p.totalPending > 0).length

    return NextResponse.json({
      success: true,
      data: {
        partners: result,
        summary: {
          totalPendingCommission: totalPendingAll,
          totalPaidCommission: totalCreditedAll,
          partnersWithPending,
          partnersTotal: result.length,
        },
      },
    })
  } catch (error) {
    console.error('[Admin Partner Commissions] GET error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch commissions' } },
      { status: 500 }
    )
  }
}
