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
    const partnerIdFilter = searchParams.get('partnerId')
    const statusFilter = searchParams.get('status') // 'pending' | 'credited' | 'all'

    const ordersCol = await getCollection('partner_orders')
    const partnersCol = await getCollection('partners')

    // Build match stage
    const match: any = {}
    if (partnerIdFilter) match.partnerId = partnerIdFilter
    if (statusFilter && statusFilter !== 'all') match['commission.status'] = statusFilter

    const orders = await ordersCol
      .find(match)
      .sort({ createdAt: -1 })
      .toArray()

    // Collect unique partnerIds
    const partnerIds = [...new Set(orders.map((o: any) => o.partnerId).filter(Boolean))]

    // Fetch partners in one query — partnerId on orders is always the partner's string `id` field
    const partners = partnerIds.length > 0
      ? await partnersCol.find({ id: { $in: partnerIds } }).toArray()
      : []

    const partnerMap: Record<string, any> = {}
    for (const p of partners) {
      const pid = p.id || p._id?.toString()
      partnerMap[pid] = p
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
      orders: any[]
    }> = {}

    for (const order of orders) {
      const pid = order.partnerId
      if (!pid) continue

      if (!grouped[pid]) {
        const partner = partnerMap[pid] || {}
        grouped[pid] = {
          partnerId: pid,
          partnerName: partner.name || partner.email || pid,
          partnerEmail: partner.email || '',
          tier: partner.tier || 'starter',
          commissionRate: order.commission?.rate ?? partner.commissionRate ?? 0,
          totalPending: 0,
          totalCredited: 0,
          orders: [],
        }
      }

      const commAmt = order.commission?.amount || 0
      const commStatus = order.commission?.status || 'pending'

      if (commStatus === 'pending') grouped[pid].totalPending += commAmt
      else if (commStatus === 'credited') grouped[pid].totalCredited += commAmt

      grouped[pid].orders.push({
        orderId: order._id?.toString() || order.orderId,
        internalOrderId: order.orderId, // the PO-xxx string
        partnerOrderId: order.partnerOrderId || null,
        createdAt: order.createdAt,
        orderTotal: order.summary?.total || 0,
        subtotal: order.summary?.subtotal || 0,
        commissionRate: order.commission?.rate || 0,
        commissionAmount: commAmt,
        commissionStatus: commStatus,
        orderStatus: order.status || 'pending',
        customer: {
          name: order.customer?.name || '',
          email: order.customer?.email || '',
        },
        items: (order.items || []).map((it: any) => ({ name: it.name, quantity: it.quantity, price: it.price })),
      })
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
