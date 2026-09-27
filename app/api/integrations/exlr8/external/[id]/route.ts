import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getCollection, createObjectId, normalizeId } from '@/lib/db-service'

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const externalCollection: any = await getCollection('external_orders')

    let doc: any = null
    // Try to treat id as ObjectId first
    try {
      doc = await externalCollection.findOne({ _id: createObjectId(id) })
    } catch (e) {
      // ignore
    }

    // Fallback: try queueId or externalOrderId
    if (!doc) {
      doc = await externalCollection.findOne({ $or: [{ queueId: id }, { externalOrderId: id }, { 'response.data.orderID': id }, { 'response.data.orderId': id }] })
    }

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(normalizeId(doc))
  } catch (error) {
    console.error('external order fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch external order' }, { status: 500 })
  }
}
