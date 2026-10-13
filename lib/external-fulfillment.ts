import { ObjectId } from "mongodb"
import { getCollection, normalizeId } from "@/lib/db-service"
import type { PricedItem } from "@/lib/order-pricing"
import { sendEmail } from "@/lib/email"
import { connectToDatabase } from "@/lib/mongodb"

export class FulfillmentError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

export interface ExternalFulfillmentRecord {
  _id: ObjectId | string
  provider?: string
  queueId?: string
  externalOrderId?: string
  orderId?: string
  userId?: string | null
  status?: string
  attempts?: number
  response?: unknown
  webhookResponse?: { message: string | null; payload: unknown }
  webhookAttempts?: number
  lastWebhookHash?: string
  updatedAt?: Date
  createdAt?: Date | string
  requestPayload?: unknown
  unitSeq?: number
  cancelledAt?: Date
  cancelledBy?: string
}

export interface FulfillmentOrder {
  _id: ObjectId
  orderId: string
  userId?: string | null
  items: PricedItem[]
  customer?: { email?: string }
  status: string
  paymentVerification?: { verified?: boolean }
  externalFulfillment?: { status: string; updatedAt: Date }
  vouchers?: Array<{ voucherCode?: string; code?: string; voucherPin?: string; pin?: string }>
}

export async function getFulfillmentOrder(id: string): Promise<FulfillmentOrder> {
  const orders = await getCollection<FulfillmentOrder>("orders")
  const order = await orders.findOne(ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { orderId: id })
  if (!order) throw new FulfillmentError("Order not found", 404)
  if (!order.paymentVerification?.verified || !["confirmed", "paid", "processing", "queued_for_external", "delivered"].includes(order.status)) {
    throw new FulfillmentError("Verified payment is required before external fulfillment", 409)
  }
  return order
}

function integrationItems(order: FulfillmentOrder) {
  const items = order.items.filter((item) => item.provider === "exlr8" || item.source === "kgen" || item.kgenProductId)
  if (!items.length) throw new FulfillmentError("Order has no external fulfillment items", 400)
  if (items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
    (!item.kgenProductId && !item.kgenVariantId))) {
    throw new FulfillmentError("Stored integration items are incomplete; administrator reconciliation is required", 409)
  }
  if (items.reduce((sum, item) => sum + item.quantity, 0) > 100) {
    throw new FulfillmentError("External fulfillment exceeds the per-order unit limit", 409)
  }
  return items
}

export async function manageQueuedExternalOrder(id: string, action: "cancel" | "retry", operatorId: string) {
  if (!id.trim() || id.length > 150) throw new FulfillmentError("Valid external order ID is required", 400)
  const { client } = await connectToDatabase()
  const session = client.startSession()
  try {
    const result = await session.withTransaction(async () => {
      const external = await getCollection<ExternalFulfillmentRecord>("external_orders")
      let doc = ObjectId.isValid(id) ? await external.findOne({ _id: new ObjectId(id) }, { session }) : null
      if (!doc) doc = await external.findOne({ _id: id }, { session })
      if (!doc) throw new FulfillmentError("External order not found", 404)

      // Only the canonical pre-dispatch queue can prove that no provider unit ran.
      const orderId = typeof doc._id === "string" && /^exlr8:[a-f0-9]{24}$/i.test(doc._id)
        ? new ObjectId(doc._id.slice(6)) : null
      if (!orderId || !doc.orderId || doc.attempts !== 0 || doc.requestPayload !== undefined || doc.unitSeq !== undefined ||
        doc.response !== undefined || doc.externalOrderId) {
        throw new FulfillmentError("Provider or legacy entry requires reconciliation before any retry or cancellation", 409)
      }
      const orders = await getCollection<FulfillmentOrder>("orders")
      const order = await orders.findOne({ _id: orderId, orderId: doc.orderId }, { session })
      if (!order) throw new FulfillmentError("Linked order requires reconciliation", 409)
      if (action === "cancel" && doc.status === "cancelled" && order.externalFulfillment?.status === "cancelled") {
        return { item: normalizeId(doc), message: "Already cancelled" }
      }
      if (doc.status !== "queued" || order.externalFulfillment?.status !== "queued") {
        throw new FulfillmentError("Fulfillment has already started or changed; provider reconciliation is required", 409)
      }
      if (action === "retry") {
        return { item: normalizeId(doc), message: "Already queued. No provider placement was retried." }
      }
      const now = new Date()
      const stopped = await orders.updateOne(
        { _id: order._id, "externalFulfillment.status": "queued" },
        { $set: { externalFulfillment: { status: "cancelled", updatedAt: now }, updatedAt: now } },
        { session },
      )
      if (stopped.modifiedCount !== 1) throw new FulfillmentError("Fulfillment changed before cancellation", 409)
      const changes = { status: "cancelled", cancelledAt: now, cancelledBy: operatorId, updatedAt: now }
      const cancelled = await external.updateOne({ _id: doc._id, status: "queued" }, { $set: changes }, { session })
      if (cancelled.modifiedCount !== 1) throw new FulfillmentError("Queue changed before cancellation", 409)
      return { item: normalizeId({ ...doc, ...changes }), message: "Queued fulfillment cancelled. The customer order was not refunded." }
    })
    if (!result) throw new FulfillmentError("Queue management did not complete", 500)
    return result
  } finally {
    await session.endSession()
  }
}

export async function queueExternalOrder(id: string) {
  const order = await getFulfillmentOrder(id)
  const items = integrationItems(order)
  const { client, db } = await connectToDatabase()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const claim = await db.collection<FulfillmentOrder>("orders").updateOne(
        { _id: order._id, externalFulfillment: { $exists: false }, "paymentVerification.verified": true },
        { $set: { externalFulfillment: { status: "queued", updatedAt: new Date() } } },
        { session },
      )
      if (!claim.modifiedCount) throw new FulfillmentError("External fulfillment already queued or attempted", 409)
      await db.collection<{ _id: string; [key: string]: unknown }>("external_orders").insertOne({
        _id: `exlr8:${order._id}`, provider: "exlr8", orderId: order.orderId, userId: order.userId || null,
        items, status: "queued", attempts: 0, createdAt: new Date(), updatedAt: new Date(),
      }, { session })
    })
  } finally {
    await session.endSession()
  }
  return { queueId: `exlr8:${order._id}` }
}

export async function fulfillExternalOrder(id: string) {
  const order = await getFulfillmentOrder(id)
  const items = integrationItems(order)
  const baseUrl = process.env.EXLR8_BASE_URL
  const clientId = process.env.EXLR8_CLIENT_ID
  const clientSecret = process.env.EXLR8_CLIENT_SECRET
  const dpId = process.env.EXLR8_DP_ID || process.env.EXLR8_DP
  if (!baseUrl || !clientId || !clientSecret || !dpId) {
    throw new FulfillmentError("eXlr8 fulfillment is not configured; order remains queued", 503)
  }
  const orders = await getCollection<FulfillmentOrder>("orders")
  const claimed = await orders.updateOne({
    _id: order._id,
    "paymentVerification.verified": true,
    status: { $in: ["confirmed", "paid", "processing", "queued_for_external", "delivered"] },
    $or: [{ externalFulfillment: { $exists: false } }, { "externalFulfillment.status": "queued" }],
  }, { $set: { externalFulfillment: { status: "processing", updatedAt: new Date() } } })
  if (!claimed.modifiedCount) throw new FulfillmentError("External fulfillment already attempted; reconcile before retrying", 409)
  const external = await getCollection<{ _id: string; [key: string]: unknown }>("external_orders")
  let sequence = 0
  let placed = 0
  let needsReconciliation = 0
  for (const item of items) {
    for (let unit = 0; unit < item.quantity; unit++) {
      const ref = `${order.orderId}-${++sequence}`
      const recordId = `exlr8:${order._id}:${sequence}`
      const payload = {
        dpID: dpId, externalRefID: ref,
        ...(item.kgenVariantId ? { variantID: item.kgenVariantId } : { productID: item.kgenProductId }),
      }
      await external.insertOne({
        _id: recordId, provider: "exlr8", orderId: order.orderId, userId: order.userId || null,
        status: "attempting", unitSeq: sequence, requestPayload: payload, createdAt: new Date(), updatedAt: new Date(),
      })
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/orders/b2b/direct-checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-client-id": clientId, "x-client-secret": clientSecret },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) throw new Error(`Upstream fulfillment returned HTTP ${response.status}`)
        const data = await response.json()
        await external.updateOne({ _id: recordId }, {
          $set: { status: "placed", response: data, updatedAt: new Date() },
        })
        placed++
        const vouchers: Array<{ voucherCode?: string; code?: string; voucherPin?: string; pin?: string }> = [
          ...(data.vouchers || []), ...(data.data?.vouchers || []),
          ...(data.lineItems || data.data?.lineItems || []).flatMap((line: { vouchers?: unknown[] }) => line.vouchers || []),
        ]
        if (vouchers.length) {
          await orders.updateOne({ _id: order._id }, { $push: { vouchers: { $each: vouchers } } })
          if (order.customer?.email) {
            try {
              const text = vouchers.map((voucher) => `Code: ${voucher.voucherCode || voucher.code || ""}\nPIN: ${voucher.voucherPin || voucher.pin || ""}`).join("\n\n")
              const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              const sent = await sendEmail({
                to: order.customer.email, subject: `Your vouchers - ${order.orderId}`,
                html: `<pre>${escaped}</pre>`,
              })
              if (!sent.success) throw new Error("Voucher email delivery failed")
            } catch (error) {
              console.error("[fulfillment] Voucher email failed; vouchers remain stored on the order", error)
            }
          }
        }
      } catch (error) {
        needsReconciliation++
        console.error("[fulfillment] Upstream outcome requires reconciliation", error)
        await external.updateOne({ _id: recordId }, {
          $set: { status: "needs_reconciliation", updatedAt: new Date() },
        })
      }
    }
  }
  await orders.updateOne({ _id: order._id }, {
    $set: {
      externalFulfillment: { status: needsReconciliation ? "needs_reconciliation" : "placed", updatedAt: new Date() },
      updatedAt: new Date(),
    },
  })
  await external.updateOne({ _id: `exlr8:${order._id}` }, {
    $set: { status: needsReconciliation ? "needs_reconciliation" : "placed", updatedAt: new Date() },
  })
  return { placedCount: placed, reconciliationCount: needsReconciliation }
}
