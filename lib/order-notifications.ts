import { getCollection } from "@/lib/db-service"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/html"
import { OrderNotificationSettingsSchema } from "@/lib/validation"
import { ObjectId, type Document } from "mongodb"
import { orderScopeForUser, orderWithinAdminScope, type OrderAccessUser } from "@/lib/order-access"

export const ORDER_NOTIFICATION_SETTINGS_ID = "confirmed-orders"
export const ORDER_NOTIFICATION_COLLECTION = "order_notification_settings"

export async function getOrderNotificationSettings() {
  const record = await (await getCollection<Document & { _id: string }>(ORDER_NOTIFICATION_COLLECTION)).findOne({ _id: ORDER_NOTIFICATION_SETTINGS_ID })
  return OrderNotificationSettingsSchema.parse(record
    ? { enabled: record.enabled, email: record.email }
    : { enabled: false, email: "" })
}

// Claim before SMTP: callback/status replays must not resend customer data.
// A crash after SMTP acceptance is ambiguous; never automatically resend it.
export async function notifyAdminOrder(
  id: ObjectId | string,
  source: "orders" | "partner_orders" = "orders",
  event: "created" | "confirmed" = "confirmed",
) {
  const field = `adminNotifications.${event}`
  try {
    const collection = await getCollection<Document & { _id: ObjectId | string }>(source)
    const order = await collection.findOne({ _id: id })
    if (!order) return { status: "skipped" }
    const eligible = order.status === "confirmed" ||
      (order.paymentVerification?.verified === true &&
        ["processing", "shipped", "delivered", "completed"].includes(order.status))
    if (event === "confirmed" && !eligible) return { status: "skipped" }
    const settings = await getOrderNotificationSettings()
    const storeSettings = await (await getCollection("settings")).findOne({})
    const employees = await (await getCollection("employees")).find({
      dashboardAccess: true, status: "active", allowedPages: "/admin/orders",
    }).toArray()
    const users = await getCollection<OrderAccessUser>("users")
    const recipients = new Set<string>()
    for (const employee of employees) {
      if (typeof employee.email !== "string") continue
      const user = await users.findOne(typeof employee.userId === "string" && ObjectId.isValid(employee.userId)
        ? { _id: new ObjectId(employee.userId) } : { email: employee.email.trim().toLowerCase() })
      if (orderWithinAdminScope(orderScopeForUser(user), order) && user?.email) {
        recipients.add(user.email.trim().toLowerCase())
      }
    }
    if (typeof storeSettings?.storeEmail === "string") recipients.add(storeSettings.storeEmail.trim().toLowerCase())
    if (event === "confirmed" && settings.enabled) recipients.add(settings.email)
    recipients.delete("")
    if (!recipients.size) return { status: "skipped" }
    const claim = await collection.updateOne(
      { _id: id, ...(event === "confirmed" ? { status: order.status } : {}),
        [field]: { $exists: false } },
      { $set: { [field]: { status: "sending", claimedAt: new Date() } } },
    )
    if (claim.modifiedCount !== 1) return { status: "already_claimed" }
    const number = String(order.orderId || id)
    const html = `<h1>Order ${event === "confirmed" ? "confirmed" : "placed"}</h1>` +
      `<p>Order: <strong>${escapeHtml(number)}</strong></p>` +
      `<p>Total: INR ${escapeHtml(String(order.total ?? order.summary?.total ?? 0))}</p>` +
      `<p>Open the authenticated admin Orders page to view customer and fulfillment details.</p>`
    let sent = 0
    let failed = 0
    for (const to of recipients) {
      const result = await sendEmail({ to, subject: `Order ${event} - ${number}`, html })
      if (result.success) sent++
      else {
        failed++
        console.error("[Order notifications] Delivery failed", { orderId: number, event })
      }
    }
    const status = failed ? "failed" : "sent"
    const completed = await collection.updateOne({ _id: id }, {
      $set: { [field]: { status, claimedAt: new Date(), completedAt: new Date(), sent, failed } },
    })
    if (!completed.acknowledged || completed.matchedCount !== 1) {
      throw new Error("Notification delivery state was not persisted")
    }
    return { status, sent, failed }
  } catch (error) {
    console.error("[Order notifications] Notification requires operator attention", { orderId: String(id), event }, error)
    // Do not turn an already committed order into an unsuccessful checkout.
    return { status: "error" }
  }
}
