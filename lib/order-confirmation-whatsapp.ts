import { ObjectId, type Document } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { normaliseIndianPhone } from "@/lib/marketing/whatsapp"
import { sendWhatsAppTemplate } from "@/lib/whatsapp-template"

const FIELD = "customerNotifications.confirmationWhatsApp"
const compact = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 700) || "-"

/** The six body parameters match the editable AskEva order-confirmation template. */
export function confirmationWhatsAppValues(order: Document): string[] {
  const customer = order.customer || {}
  const fulfilment = order.fulfilment || {}
  const address = order.shippingAddress || customer.address || {}
  const delivery = fulfilment.method === "pickup"
    ? `Pickup from ${fulfilment.storeName || order.storePayment?.storeName || "your selected store"}. We will notify you when it is ready.`
    : `Delivery to ${typeof address === "string" ? address : [address.street || address.line1, address.city || customer.city,
      address.state || customer.state, address.zip || address.zipCode || address.pincode || customer.zipCode].filter(Boolean).join(", ") || "your delivery address"}`
  const method = String(order.paymentMethod || order.paymentDetails?.method || "").toLowerCase()
  const payment = method === "cod" || method === "cash" ? "Cash on delivery — pay when your order arrives"
    : order.storePayment ? `Paid at ${order.storePayment.storeName || "the store"} via ${order.storePayment.platform || "store payment"}`
    : method === "instore" ? "In-store purchase approved"
    : `${method === "razorpay" || method === "online" ? "Razorpay" : method === "pinelabs" ? "Pine Labs" : method === "paytm" ? "Paytm" : "Online payment"} — ${order.paymentVerification?.verified === true ? "payment received" : "payment verification pending"}`
  const items = (Array.isArray(order.items) ? order.items : []).filter(item => item && typeof item === "object")
    .map(item => `${item.name || "Item"} × ${Number(item.quantity) || 1}`).join("; ")
  return [customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Customer",
    String(order.orderId || order._id), items,
    `₹${Number(order.total ?? order.summary?.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    payment, delivery].map(value => compact(String(value)))
}

/** Claim atomically so repeated callbacks and admin updates do not send duplicates. */
export async function notifyCustomerOrderConfirmed(id: ObjectId | string) {
  try {
    const orders = await getCollection<Document & { _id: ObjectId | string }>("orders")
    const order = await orders.findOne({ _id: id })
    if (!order || !(order.status === "confirmed" || (order.paymentVerification?.verified === true &&
      ["processing", "shipped", "delivered", "completed"].includes(order.status)))) return { status: "skipped" }
    const phone = normaliseIndianPhone(String(order.customer?.phone || ""))
    if (!phone) return { status: "skipped", reason: "missing_or_invalid_phone" }
    if (!process.env.ASKEVA_API_KEY || !process.env.ASKEVA_API_URL) {
      console.error("[Order confirmation WhatsApp] ASKEVA_API_KEY / ASKEVA_API_URL are missing")
      return { status: "not_configured" }
    }
    const claim = await orders.updateOne({ _id: id, status: order.status, [FIELD]: { $exists: false } }, {
      $set: { [FIELD]: { status: "sending", claimedAt: new Date() } },
    })
    if (claim.modifiedCount !== 1) return { status: "already_claimed" }
    // Do not automatically retry an ambiguous timeout: the provider may have accepted it.
    let status = "failed"
    let messageId: string | undefined
    try {
      const result = await sendWhatsAppTemplate(phone.slice(2), {
        name: process.env.ORDER_CONFIRMATION_WHATSAPP_TEMPLATE?.trim() || "sara_order_confirmed_v2",
        language: { policy: "deterministic", code: process.env.ORDER_CONFIRMATION_WHATSAPP_LANGUAGE?.trim() || "en" },
        components: [{ type: "body", parameters: confirmationWhatsAppValues(order).map(text => ({ type: "text", text })) }],
      }, undefined, "Order confirmation WhatsApp")
      if (result.success) {
        status = "accepted"
        messageId = result.data.messages[0].id
      }
    } catch {
      console.error("[Order confirmation WhatsApp] Provider request failed")
    }
    const saved = await orders.updateOne({ _id: id, [`${FIELD}.status`]: "sending" }, {
      $set: { [`${FIELD}.status`]: status, [`${FIELD}.completedAt`]: new Date(),
        ...(messageId ? { [`${FIELD}.messageId`]: messageId } : {}) },
    })
    if (!saved.acknowledged || saved.matchedCount !== 1) throw new Error("Notification result was not persisted")
    if (status === "failed") console.error("[Order confirmation WhatsApp] Message was not accepted", { orderId: String(order.orderId || id) })
    return { status }
  } catch {
    console.error("[Order confirmation WhatsApp] Notification requires attention", { orderId: String(id) })
    return { status: "error" }
  }
}
