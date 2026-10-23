import crypto from "node:crypto"
import { type ClientSession, ObjectId } from "mongodb"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { priceOrder, type IncomingItem, type PricingSuccess } from "@/lib/order-pricing"
import { quoteRedemption } from "@/lib/loyalty"

export const CheckoutQuoteSchema = z.object({
  items: z.array(z.object({
    id: z.string().max(200).optional(),
    productId: z.string().max(200).optional(),
    sku: z.string().max(200).nullish(),
    quantity: z.coerce.number().int().positive().max(1000000),
    color: z.string().max(100).nullish(),
    size: z.string().max(100).nullish(),
  })).min(1).max(100),
  couponCode: z.string().max(100).nullish(),
  redeemPoints: z.number().int().nonnegative().max(1000000).default(0),
  fulfilment: z.object({
    method: z.enum(["delivery", "pickup"]),
    storeId: z.string().max(100).optional(),
  }).optional(),
  currency: z.literal("INR").default("INR"),
})

export function hashCheckoutToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function checkoutFingerprint(
  pricing: PricingSuccess,
  options: { fulfilment?: { method?: string; storeId?: string } | null; redeemPoints?: number },
  amount: number,
): string {
  return hashCheckoutToken(JSON.stringify({
    items: [...pricing.items].sort((a, b) => a.id.localeCompare(b.id)),
    couponCode: pricing.coupon?.code || null,
    fulfilment: { method: options.fulfilment?.method || "delivery", storeId: options.fulfilment?.storeId || null },
    redeemPoints: options.redeemPoints || 0,
    amount: Math.round(amount * 100),
  }))
}

export async function quoteCheckout(
  items: IncomingItem[],
  options: { couponCode?: string | null; userId: string | null; fulfilment?: { method?: string; storeId?: string }; redeemPoints?: number },
) {
  const pricing = await priceOrder(items, options)
  if (!pricing.ok) return pricing
  let amount = pricing.total
  if (options.redeemPoints) {
    if (!options.userId) return { ok: false as const, error: "Sign in to redeem rewards" }
    const quote = await quoteRedemption({
      userId: options.userId, points: options.redeemPoints, orderTotal: pricing.total,
    })
    if (!quote.ok) return quote
    amount = Math.max(0, pricing.total - quote.discount)
  }
  return { ok: true as const, pricing, amount, fingerprint: checkoutFingerprint(pricing, options, amount) }
}

export interface CheckoutIntent {
  _id: string
  userId: string | null
  tokenHash: string
  fingerprint: string
  amount: number
  currency: "INR"
  method: "razorpay" | "instore" | "pinelabs" | "paytm" | "store-payment"
  status: "created" | "verified" | "consumed"
  createdAt: Date
  expiresAt: Date
  paymentId?: string
  orderId?: string
  employeeId?: string
  employeeEmail?: string
  merchantReference?: string
  needsReview?: boolean
  store?: { id: string; name: string; phone: string; email: string }
}

export async function createCheckoutIntent(
  orderId: string,
  userId: string | null,
  quote: { amount: number; fingerprint: string },
  method: CheckoutIntent["method"] = "razorpay",
  extra: { ttlMs?: number; store?: CheckoutIntent["store"] } = {},
): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url")
  const collection = await getCollection<CheckoutIntent>("checkout_intents")
  await collection.insertOne({
    _id: orderId, userId, tokenHash: hashCheckoutToken(token), fingerprint: quote.fingerprint,
    amount: Math.round(quote.amount * 100), currency: "INR", method, status: "created",
    createdAt: new Date(), expiresAt: new Date(Date.now() + (extra.ttlMs ?? 60 * 60 * 1000)),
    ...(extra.store ? { store: extra.store } : {}),
  })
  return token
}

export async function getCheckoutIntent(orderId: string, token: string, userId: string | null) {
  const collection = await getCollection<CheckoutIntent>("checkout_intents")
  return collection.findOne({
    _id: orderId, tokenHash: hashCheckoutToken(token), userId, expiresAt: { $gt: new Date() },
  })
}

export class CheckoutConflictError extends Error {}

export async function persistCheckoutOrder(
  order: Record<string, unknown>,
  intent: CheckoutIntent | null,
  beforeInsert?: (session: ClientSession) => Promise<void>,
): Promise<ObjectId> {
  const { client, db } = await connectToDatabase()
  const session = client.startSession()
  const id = new ObjectId()
  try {
    await session.withTransaction(async () => {
      if (intent) {
        const hosted = intent.method === "pinelabs" || intent.method === "paytm"
        // A store payment is settled offline, so its request is never "verified" online.
        const expected = hosted || intent.method === "store-payment" ? "created" : "verified"
        const claimed = await db.collection<CheckoutIntent>("checkout_intents").updateOne(
          { _id: intent._id, status: expected, orderId: { $exists: false }, expiresAt: { $gt: new Date() }, ...(intent.paymentId ? { paymentId: intent.paymentId } : {}) },
          { $set: { status: hosted ? "created" : "consumed", orderId: String(order.orderId) } },
          { session },
        )
        if (!claimed.modifiedCount) throw new CheckoutConflictError("Checkout payment has already been used or expired")
      }
      if (beforeInsert) await beforeInsert(session)
      if (intent?.method === "razorpay") {
        await db.collection<{ _id: string; [key: string]: unknown }>("payments").insertOne({
          _id: intent.paymentId!, razorpayOrderId: intent._id, razorpayPaymentId: intent.paymentId,
          providerOrderId: intent._id, providerPaymentId: intent.paymentId,
          status: "completed", method: "razorpay", amount: intent.amount / 100,
          currency: intent.currency, userId: intent.userId, orderId: order.orderId, createdAt: new Date(),
        }, { session })
      }
      await db.collection("orders").insertOne({ ...order, _id: id }, { session })
    })
    return id
  } finally {
    await session.endSession()
  }
}
