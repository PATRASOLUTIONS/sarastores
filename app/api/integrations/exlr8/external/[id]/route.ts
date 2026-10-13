import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getCollection, normalizeId } from '@/lib/db-service'
import { ObjectId } from 'mongodb'
import type { ExternalFulfillmentRecord } from '@/lib/external-fulfillment'

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    if (!id || id.length > 150) return NextResponse.json({ error: 'Valid external order ID is required' }, { status: 400 })
    const externalCollection = await getCollection<ExternalFulfillmentRecord>('external_orders')
    let doc = ObjectId.isValid(id) ? await externalCollection.findOne({ _id: new ObjectId(id) }) : null

    // Fallback: try queueId or externalOrderId
    if (!doc) {
      doc = await externalCollection.findOne({ $or: [{ _id: id }, { queueId: id }, { externalOrderId: id }, { 'response.data.orderID': id }, { 'response.data.orderId': id }] })
    }

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(normalizeId(doc))
  } catch (error) {
    console.error('external order fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch external order' }, { status: 500 })
  }
}
