import { NextRequest, NextResponse } from 'next/server'
import { assignMissingLicenses, LicenseRepairDaysSchema, missingLicenseQuery } from '@/scripts/assign-missing-licenses'
import { requireAdmin } from '@/lib/auth'
import { getCollection } from '@/lib/db-service'
import type { OrderDocument } from '@/lib/order-document'
import { z } from 'zod'

const inputSchema = z.object({ daysBack: LicenseRepairDaysSchema.default(30) }).strict()

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const text = await request.text()
    let body: unknown = {}
    try { if (text.trim()) body = JSON.parse(text) } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'daysBack must be an integer between 1 and 3650' }, { status: 400 })
    const stats = await assignMissingLicenses(parsed.data.daysBack)
    return NextResponse.json({
      success: stats.errors.length === 0,
      message: stats.errors.length ? 'License repair completed with errors; review the results before retrying' : 'License repair completed',
      stats: { ...stats, errorsCount: stats.errors.length },
    })
  } catch (error) {
    console.error('[license-repair] API failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to assign licenses' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = inputSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) return NextResponse.json({ error: 'daysBack must be an integer between 1 and 3650' }, { status: 400 })
    const orders = await getCollection<OrderDocument>('orders')
    const count = await orders.countDocuments(missingLicenseQuery(parsed.data.daysBack))
    return NextResponse.json({
      success: true, daysBack: parsed.data.daysBack, ordersNeedingLicenses: count,
      message: `${count} verified paid order(s) need local software fulfillment`,
    })
  } catch (error) {
    console.error('[license-repair] Preview failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to check orders' }, { status: 500 })
  }
}
