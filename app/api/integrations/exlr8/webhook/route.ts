import { NextResponse } from "next/server"
import { getCollection, createObjectId } from "@/lib/db-service"
import crypto from "crypto"

// Webhook receiver for eXlr8/KGen to reconcile external order status
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Verify a shared secret — required, never optional
    const expectedSecret = process.env.EXLR8_WEBHOOK_SECRET
    if (!expectedSecret) {
      console.error('EXLR8_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
    const incomingSecret = (request.headers.get('x-webhook-secret') || '')
    const incomingBuffer = Buffer.from(incomingSecret)
    const expectedBuffer = Buffer.from(expectedSecret)
    if (incomingBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(incomingBuffer, expectedBuffer)) {
      console.warn('Webhook secret mismatch')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { queueId, externalOrderId, orderId, status, message, payload } = body || {}

    if (!orderId && !queueId && !externalOrderId) {
      return NextResponse.json({ error: 'Missing identifiers (orderId | queueId | externalOrderId)' }, { status: 400 })
    }

  const externalCollection: any = await getCollection('external_orders')
  const ordersCollection: any = await getCollection('orders')

    // Try to find the external queue doc
    let extFilter: any = {}
    if (queueId) extFilter._id = createObjectId(queueId)
    else if (externalOrderId) extFilter.externalOrderId = externalOrderId
    else if (orderId) extFilter.orderId = orderId

    const extDoc = await externalCollection.findOne(extFilter)

    if (extDoc) {
      const updateFields: any = {
        status: status || 'updated',
        response: { message: message || null, payload: payload || null },
        updatedAt: new Date(),
      }
      await externalCollection.updateOne({ _id: extDoc._id }, { $set: updateFields, $inc: { attempts: 1 } })

      // Update main order accordingly
      if (extDoc.orderId) {
        const newOrderStatus = status === 'fulfilled' ? 'confirmed' : (status === 'failed' ? 'failed' : 'processing')
        await ordersCollection.updateOne(
          { _id: createObjectId(extDoc.orderId) },
          {
            $set: { updatedAt: new Date(), status: newOrderStatus },
            $push: {
              timeline: {
                $each: [ {
                  date: new Date().toISOString(),
                  status: `External: ${status}`,
                  description: message || `External provider status: ${status}`,
                } ],
              },
            },
          }
        )
      }

      return NextResponse.json({ success: true })
    }

    // If no ext doc found but orderId provided, attach a generic timeline update
    if (orderId) {
      await ordersCollection.updateOne(
        { _id: createObjectId(orderId) },
        {
          $set: { updatedAt: new Date() },
          $push: {
            timeline: {
              $each: [ {
                date: new Date().toISOString(),
                status: `ExternalWebhook: ${status || 'update'}`,
                description: message || 'External webhook received',
              } ],
            },
          },
        }
      )
      return NextResponse.json({ success: true, note: 'Order timeline updated' })
    }

    return NextResponse.json({ error: 'No matching external queue or order found' }, { status: 404 })
  } catch (error) {
    console.error('Webhook handling error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
