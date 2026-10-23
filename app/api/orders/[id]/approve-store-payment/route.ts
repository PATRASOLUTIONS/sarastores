import { type NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getCollection, normalizeId } from "@/lib/db-service"
import { requireAdmin, getSession } from "@/lib/auth"
import { getOrderAdminScope, orderWithinAdminScope } from "@/lib/order-access"
import { getEmailTemplate, getEmailSubject, getEmailTemplateId } from "@/lib/emailTemplates"
import { sendEmail } from "@/lib/email"
import { notifyAdminOrder } from "@/lib/order-notifications"
import { notifyOrderStatus } from "@/lib/push"
import { sendStorePaymentApprovedEmail } from "@/lib/store-payment"
import type { OrderDocument } from "@/lib/order-document"

const headers = { "Cache-Control": "private, no-store" }

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers })
    const scope = await getOrderAdminScope(session)
    const { id } = await context.params
    const collection = await getCollection<OrderDocument>("orders")
    const order = await collection.findOne(ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { orderId: id })
    if (!order || !orderWithinAdminScope(scope, order)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers })
    }
    if (order.storePayment?.status !== "confirmation_pending" || order.status !== "pending") {
      return NextResponse.json({ error: "This order has no store payment awaiting confirmation" }, { status: 409, headers })
    }

    const now = new Date()
    const approvedBy = { id: session.user.id, name: session.user.name || "", email: session.user.email }
    const updated = await collection.findOneAndUpdate(
      { ...scope.filter, _id: order._id, status: "pending", "storePayment.status": "confirmation_pending" },
      {
        $set: {
          status: "processing",
          "storePayment.status": "approved",
          "storePayment.approvedBy": approvedBy,
          "storePayment.approvedAt": now,
          "paymentDetails.status": "completed",
          paymentVerification: {
            verified: true,
            method: "store-payment",
            platform: order.storePayment.platform,
            transactionId: order.storePayment.transactionId,
            verifiedAt: now,
            verifiedBy: approvedBy.email,
          },
          updatedAt: now,
        },
        $push: {
          timeline: {
            $each: [{
              date: now.toISOString(),
              status: "Processing",
              description: `Payment confirmed at ${order.storePayment.storeName}. Your order is being prepared.`,
            }],
            $position: 0,
          },
        },
      },
      { returnDocument: "after" },
    )
    if (!updated) {
      return NextResponse.json({ error: "Order changed before approval; reload and try again" }, { status: 409, headers })
    }

    const orderNumber = String(updated.orderId || id)
    let customerEmailSent: boolean | null = null
    if (updated.customer?.email) {
      try {
        const templateId = getEmailTemplateId("processing")
        const result = await sendEmail({
          to: updated.customer.email,
          subject: getEmailSubject(templateId, orderNumber),
          html: getEmailTemplate(templateId, {
            orderNumber,
            customerName: updated.customer.name || "Customer",
            status: "processing",
            orderDetails: { total: Number(updated.total) || 0, items: updated.items || [], shippingAddress: updated.customer.address },
          }),
        })
        customerEmailSent = result.success
      } catch (error) {
        customerEmailSent = false
        console.error("[Store payment approval] Customer email failed:", error)
      }
    }
    if (updated.userId) {
      void notifyOrderStatus(String(updated.userId), orderNumber, "processing")
        .catch(error => console.error("[Store payment approval] Push failed:", error))
    }
    const adminNotification = await notifyAdminOrder(updated._id, "orders", "confirmed")
    const staffNotification = await sendStorePaymentApprovedEmail(updated, approvedBy)
      .catch(error => { console.error("[Store payment approval] Staff email failed:", error); return { status: "failed" as const } })

    const safeOrder = normalizeId(updated)
    delete safeOrder.guestAccessTokenHash
    return NextResponse.json({
      ...safeOrder,
      notification: { customerEmailSent, adminNotification, staffNotification },
    }, { headers })
  } catch (error) {
    console.error("[Store payment approval]", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to approve store payment" }, { status: 500, headers })
  }
}
