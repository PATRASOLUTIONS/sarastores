import { after } from "next/server"
import { ObjectId, type ClientSession } from "mongodb"
import { getCollection, normalizeId } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { createCheckoutIntent, CheckoutConflictError, type CheckoutIntent } from "@/lib/checkout-payment"
import { consumeOrderCoupon, type PricedItem, type PricingSuccess } from "@/lib/order-pricing"
import { redeemPoints } from "@/lib/loyalty"
import { paymentEnabled, paymentSiteOrigin, PaymentConfigurationError } from "@/lib/payment-config"
import { createHostedProviderOrder, verifyHostedProviderPayment, type HostedProviderOrder } from "@/lib/hosted-payment-providers"
import { fulfillSoftwareOrder } from "@/lib/software-fulfillment"
import { queueExternalOrder, fulfillExternalOrder } from "@/lib/external-fulfillment"
import type { HostedPaymentProvider } from "@/types/payment-gateways"
import { escapeHtml } from "@/lib/html"
import { notifyAdminOrder } from "@/lib/order-notifications"
import { notifyCustomerOrderConfirmed } from "@/lib/order-confirmation-whatsapp"
import { consumeGiftPromotions } from "@/lib/gift-promotions"
import type { GiftAward } from "@/lib/gift-validation"

interface HostedOrder {
  _id: ObjectId
  orderId: string
  userId: string | null
  total: number
  subtotal: number
  tax: number
  shipping: number
  status: string
  items: PricedItem[]
  customer: { firstName: string; lastName: string; name: string; email: string; phone: string | null }
  coupon: PricingSuccess["coupon"]
  loyalty: { pointsRedeemed: number; discount: number } | null
  paymentDetails: { status: string; method: string; orderId: string; paymentId?: string }
  paymentMethod: string
  fulfilment?: { method?: string; storeId?: string }
  giftPromotions?: GiftAward[]
}

export function notifyHostedGuestOrder(orderId: string, email: string, guestAccessToken: string) {
  const url = `${paymentSiteOrigin()}/order/${encodeURIComponent(orderId)}?token=${encodeURIComponent(guestAccessToken)}`
  after(async () => {
    try {
      const { sendEmail } = await import("@/lib/email")
      const result = await sendEmail({
        to: email, subject: `Your private order link - ${orderId}`,
        html: `<p>Your checkout for <strong>${escapeHtml(orderId)}</strong> has started. Payment is not yet confirmed.</p>` +
          `<p><a href="${escapeHtml(url)}">View your order and payment status</a></p><p>Keep this link private.</p>`,
      })
      if (!result.success) console.error("[Hosted checkout] Guest order-link notification failed")
    } catch (error) {
      console.error("[Hosted checkout] Guest order-link notification failed", error)
    }
  })
}

export async function initiateHostedCheckout(
  provider: HostedPaymentProvider,
  reference: string,
  userId: string | null,
  quote: { amount: number; fingerprint: string },
  customer: HostedOrder["customer"],
): Promise<HostedProviderOrder & { checkoutToken: string; provider: HostedPaymentProvider }> {
  if (!paymentEnabled(provider)) throw new PaymentConfigurationError("This payment gateway is disabled")
  const callbackUrl = `${paymentSiteOrigin()}/api/payment/${provider}/return`
  const created = await createHostedProviderOrder(provider, {
    reference, amount: Math.round(quote.amount * 100), userId, callbackUrl, customer,
  })
  const checkoutToken = await createCheckoutIntent(created.orderId, userId, quote, provider)
  await (await getCollection<CheckoutIntent>("checkout_intents")).updateOne(
    { _id: created.orderId }, { $set: { merchantReference: reference } },
  )
  return { ...created, checkoutToken, provider }
}

async function consumeHostedDiscounts(order: HostedOrder, session: ClientSession) {
  try { await consumeGiftPromotions(order.giftPromotions || [], order.orderId, order.userId, session) }
  catch (error) { throw new CheckoutConflictError(error instanceof Error ? error.message : "Free gift usage could not be recorded") }
  if (order.coupon) {
    const result = await consumeOrderCoupon(order.items, order.coupon, order.userId, session, order.fulfilment?.method === "pickup" ? "store" : "overall")
    if (!result.ok) throw new CheckoutConflictError(result.error)
  }
  if (order.userId && order.loyalty) {
    const result = await redeemPoints({
      userId: order.userId, orderId: order.orderId, points: order.loyalty.pointsRedeemed,
      orderTotal: order.total + order.loyalty.discount, session,
    })
    if (!result.ok) throw new CheckoutConflictError(result.error)
  }
}

async function hostedPaymentEffects(order: HostedOrder) {
  await notifyCustomerOrderConfirmed(order._id)
  if (order.items.some(item => item.type === "software" && !item.provider)) {
    try {
      await fulfillSoftwareOrder(order._id.toString())
    } catch (error) {
      console.error("[Hosted checkout] Software fulfillment requires attention", error)
      await (await getCollection("orders")).updateOne({ _id: order._id }, {
        $set: { licenseFulfillment: { status: "needs_inventory", updatedAt: new Date() } },
      })
    }
  }
  if (order.items.some(item => item.provider === "exlr8" || item.source === "kgen" || item.kgenProductId)) {
    try {
      await queueExternalOrder(order._id.toString())
      await fulfillExternalOrder(order._id.toString())
    } catch (error) {
      console.error("[Hosted checkout] External fulfillment requires reconciliation", error)
    }
  }
  try {
    const { sendEmail, getVendorOrderNotificationTemplate } = await import("@/lib/email")
    const html = getVendorOrderNotificationTemplate(normalizeId(order))
    const result = await sendEmail({ to: order.customer.email, subject: `Payment confirmed - ${order.orderId}`, html })
    if (!result.success) console.error("[Hosted checkout] Customer payment notification failed")
  } catch (error) {
    console.error("[Hosted checkout] Payment notifications failed", error)
  }
  await notifyAdminOrder(order._id)
}

export async function reconcileHostedCheckout(intent: CheckoutIntent): Promise<"pending" | "failed" | "completed" | "review"> {
  if (intent.method !== "pinelabs" && intent.method !== "paytm") throw new Error("Not a hosted checkout")
  if (!intent.orderId || !intent.merchantReference) throw new Error("Hosted checkout order is not persisted")
  if (intent.status === "consumed") return intent.needsReview ? "review" : "completed"
  // Disable flags stop NEW transactions only. Existing payments must still settle.
  const verified = await verifyHostedProviderPayment(intent.method, {
    orderId: intent._id, reference: intent.merchantReference, amount: intent.amount,
  })
  const orders = await getCollection<HostedOrder>("orders")
  if (verified.status !== "completed") {
    await orders.updateOne(
      { orderId: intent.orderId, "paymentDetails.status": { $ne: "completed" } },
      { $set: { "paymentDetails.status": verified.status, updatedAt: new Date() } },
    )
    const current = await (await getCollection<CheckoutIntent>("checkout_intents")).findOne({ _id: intent._id })
    if (current?.status === "consumed") return current.needsReview ? "review" : "completed"
    return verified.status
  }
  const { client, db } = await connectToDatabase()
  const session = client.startSession()
  let completed: HostedOrder | null = null
  let review = false
  const persistPayment = async (needsReview: boolean) => {
    await session.withTransaction(async () => {
      completed = null
      const claimed = await db.collection<CheckoutIntent>("checkout_intents").updateOne(
        { _id: intent._id, status: "created", orderId: intent.orderId },
        { $set: { status: "consumed", paymentId: verified.paymentId, needsReview } },
        { session },
      )
      if (!claimed.modifiedCount) return
      const order = await db.collection<HostedOrder>("orders").findOne({ orderId: intent.orderId }, { session })
      if (!order || order.paymentDetails.orderId !== intent._id || order.paymentDetails.method !== intent.method ||
        order.userId !== intent.userId || Math.round(order.total * 100) !== intent.amount) {
        throw new Error("Stored order does not match the payment intent")
      }
      if (!needsReview && order.status !== "pending") throw new CheckoutConflictError("Order status changed before payment confirmation")
      if (!needsReview) await consumeHostedDiscounts(order, session)
      await db.collection<{ _id: string; [key: string]: unknown }>("payments").insertOne({
        _id: `${intent.method}:${verified.paymentId}`,
        providerOrderId: intent._id, providerPaymentId: verified.paymentId,
        orderId: intent.orderId, userId: intent.userId, amount: intent.amount / 100,
        currency: intent.currency, method: intent.method, status: "completed", createdAt: new Date(),
      }, { session })
      await db.collection<HostedOrder>("orders").updateOne({ _id: order._id }, {
        $set: {
          status: needsReview ? "payment_review" : "confirmed",
          "paymentDetails.status": "completed", "paymentDetails.paymentId": verified.paymentId,
          paymentVerification: { verified: true, method: intent.method, providerOrderId: intent._id,
            providerPaymentId: verified.paymentId, amountPaid: intent.amount / 100, checkedAt: new Date() },
          updatedAt: new Date(),
        },
        $push: { timeline: { date: new Date().toISOString(), status: "Payment Verified",
          description: needsReview ? "Payment received; administrator reconciliation required" : "Payment confirmed by the gateway" } },
      }, { session })
      completed = { ...order, status: needsReview ? "payment_review" : "confirmed",
        paymentDetails: { ...order.paymentDetails, status: "completed", paymentId: verified.paymentId } }
    })
  }
  try {
    try {
      await persistPayment(false)
    } catch (error) {
      if (!(error instanceof CheckoutConflictError)) throw error
      console.error("[Hosted checkout] Paid order requires discount/status reconciliation:", error.message)
      review = true
      await persistPayment(true)
    }
  } finally {
    await session.endSession()
  }
  if (completed) {
    const paidOrder: HostedOrder = completed
    if (!review) after(() => hostedPaymentEffects(paidOrder))
    else console.error("[Hosted checkout] Administrator action required for paid order", intent.orderId)
  }
  const current = await (await getCollection<CheckoutIntent>("checkout_intents")).findOne({ _id: intent._id })
  if (current?.status !== "consumed") throw new Error("Payment confirmation was not persisted")
  return current.needsReview ? "review" : "completed"
}
