import { NextResponse } from "next/server"
import { getCollection, createObjectId } from "@/lib/db-service"
import { requireUser } from "@/lib/auth"

// Enqueue KGen/eXlr8 items for asynchronous upstream placement (Plan B)
export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const body = await request.json()
    const { orderId, userId, items } = body || {}

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'orderId and items[] are required' }, { status: 400 })
    }

  const externalCollection: any = await getCollection('external_orders')
  const ordersCollection: any = await getCollection('orders')

    const doc: any = {
      provider: 'kgen',
      orderId,
      userId: userId || null,
      items,
      status: 'queued',
      attempts: 0,
      response: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const res = await externalCollection.insertOne(doc)
    const queueId = res.insertedId.toString()

    // Update main order with metadata linking to external queue
    try {
      await ordersCollection.updateOne(
        { _id: createObjectId(orderId) },
        {
          $set: { updatedAt: new Date(), status: 'queued_for_external' },
          $push: {
            timeline: { $each: [ { date: new Date().toISOString(), status: 'Queued for External Fulfillment', description: `Order queued to provider kgen (queueId: ${queueId})` } ] },
            externalQueue: { $each: [ { queueId, provider: 'kgen', status: 'queued', createdAt: new Date() } ] },
          },
        }
      )
    } catch (e) {
      console.warn('Failed to update order metadata after enqueue:', e)
    }

    return NextResponse.json({ success: true, queueId })
  } catch (error) {
    console.error('Error enqueuing external order:', error)
    return NextResponse.json({ error: 'Failed to enqueue external order' }, { status: 500 })
  }
}
