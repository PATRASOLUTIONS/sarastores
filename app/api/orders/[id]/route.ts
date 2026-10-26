import { type NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId, createObjectId } from "@/lib/db-service"
import { getEmailTemplate, getEmailSubject, getEmailTemplateId } from "@/lib/emailTemplates"
import { sendEmail } from "@/lib/email"
import { requireAdmin, getSession } from "@/lib/auth"
import { getOrderAdminScope, orderWithinAdminScope } from "@/lib/order-access"
import { notifyAdminOrder } from "@/lib/order-notifications"
import { verifyGuestAccessToken } from "@/lib/guest-order"
import { linkGuestOrdersToAccount } from "@/lib/guest-order-linking"
import { rebuildCustomerProfile, recordEvent, EARNING_STATUSES } from "@/lib/customer-profile"
import { awardPointsForOrder, reverseOrderPoints } from "@/lib/loyalty"
import { notifyOrderStatus } from "@/lib/push"
import { AdminOrderUpdateSchema } from "@/lib/validation"
import type { OrderDocument } from "@/lib/order-document"
import type { UpdateFilter } from "mongodb"

// Get a specific order
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Either a session or a guest capability token is required. The token alone
  // is enough because it is unguessable; the order id is not.
  const guestToken = request.nextUrl.searchParams.get("token")
  const session = await getSession()
  if (!session && !guestToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json(
        { error: "Invalid order ID provided" },
        { status: 400 }
      )
    }

    if (session) await linkGuestOrdersToAccount(session.user)

    let collection = await getCollection<OrderDocument>("orders")
    let orderId

    // Try to find in main orders collection first
    try {
      orderId = createObjectId(id.trim())
    } catch {
      // If not an ObjectId, it might be an orderId string (like PO-...)
      orderId = null
    }

    let order = orderId ? await collection.findOne({ _id: orderId }) : await collection.findOne({ orderId: id.trim() })

    // If not found in main orders, check partner_orders
    let source = 'direct'
    if (!order) {
      const partnerCollection = await getCollection<OrderDocument>("partner_orders")
      order = await partnerCollection.findOne({
        $or: [
          { orderId: id.trim() },
          { partnerOrderId: id.trim() },
          ...(orderId ? [{ _id: orderId }] : [])
        ]
      })
      if (order) {
        source = 'partner'
        collection = partnerCollection
      }
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const normalizedOrder = normalizeId(order)

    // Non-admins may only read their own order; 404 avoids confirming it exists.
    const isAdminUser = orderWithinAdminScope(await getOrderAdminScope(session), order)
    const ownerId = normalizedOrder.userId || normalizedOrder.customerId || null
    const isOwner = !!session && !!ownerId && String(ownerId) === session.user.id
    const isGuestHolder =
      verifyGuestAccessToken(guestToken, order.guestAccessTokenHash)

    if (!isAdminUser && !isOwner && !isGuestHolder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Default format for main orders
    const formattedOrder = {
      id: normalizedOrder.id,
      orderId: normalizedOrder.orderId || null,
      userId: normalizedOrder.userId || normalizedOrder.customerId || null,
      date: normalizedOrder.createdAt || new Date().toISOString(),
      status: normalizedOrder.status || "pending",
      total: normalizedOrder.total || normalizedOrder.summary?.total || 0,
      subtotal: normalizedOrder.subtotal || normalizedOrder.summary?.subtotal || 0,
      tax: normalizedOrder.tax || normalizedOrder.summary?.tax || 0,
      shipping: normalizedOrder.shipping || normalizedOrder.summary?.shipping || 0,
      coupon: normalizedOrder.coupon || null,
      items: normalizedOrder.items || [],
      giftPromotions: normalizedOrder.giftPromotions || [],
      customer: normalizedOrder.customer || {},
      shippingAddress: normalizedOrder.shippingAddress || (normalizedOrder.customer?.address && typeof normalizedOrder.customer.address === 'object' ? {
        name: normalizedOrder.customer.name || "",
        street: normalizedOrder.customer.address.line1 || "",
        city: normalizedOrder.customer.address.city || "",
        state: normalizedOrder.customer.address.state || "",
        zip: normalizedOrder.customer.address.pincode || "",
        country: normalizedOrder.customer.address.country || "India",
      } : {
        name: normalizedOrder.customer?.name || "",
        street: normalizedOrder.customer?.address || "",
        city: normalizedOrder.customer?.city || "",
        state: normalizedOrder.customer?.state || "",
        zip: normalizedOrder.customer?.zipCode || "",
        country: normalizedOrder.customer?.country || "India",
      }),
      paymentMethod: normalizedOrder.paymentMethod || "cash",
      paymentDetails: normalizedOrder.paymentDetails || {},
      paymentVerification: normalizedOrder.paymentVerification || { verified: false },
      storePayment: normalizedOrder.storePayment || null,
      fulfilment: normalizedOrder.fulfilment || { method: "delivery" },
      trackingNumber: normalizedOrder.trackingNumber || (normalizedOrder.tracking?.trackingNumber) || null,
      timeline: normalizedOrder.timeline || (normalizedOrder.statusHistory || []).map(sh => ({
        date: sh.timestamp || new Date().toISOString(),
        status: sh.status,
        description: sh.details?.note || `Order ${sh.status}`,
      })),
      notes: normalizedOrder.notes || null,
      cancellation: normalizedOrder.cancellation,
      licenseKey: normalizedOrder.licenseKey,
      licenseKeys: normalizedOrder.licenseKeys,
      licenseAssignedAt: normalizedOrder.licenseAssignedAt,
      softwareLicenses: normalizedOrder.softwareLicenses,
      source: source,
      createdAt: normalizedOrder.createdAt || new Date().toISOString(),
      updatedAt: normalizedOrder.updatedAt || new Date().toISOString(),
    }

    let partnerFields: {
      partnerId?: string; partnerOrderId?: string; commission?: number
      razorpayPaymentDetails?: unknown; partnerName?: string
    } = {}
    if (source === 'partner') {
      partnerFields = {
        partnerId: normalizedOrder.partnerId,
        partnerOrderId: normalizedOrder.partnerOrderId,
        commission: typeof normalizedOrder.commission === 'object' && normalizedOrder.commission
          ? (normalizedOrder.commission.amount || 0) : (normalizedOrder.commission || 0),
        razorpayPaymentDetails: normalizedOrder.paymentDetails,
      }

      // Fetch partner name
      try {
        const partnersCol = await getCollection<{ id?: string; name?: string }>("partners")
        const partner = await partnersCol.findOne({ id: normalizedOrder.partnerId })
        if (partner) {
          partnerFields.partnerName = partner.name
        }
      } catch (error) {
        console.warn("Failed to fetch partner name for order detail:", error)
      }
    }

    return NextResponse.json({ ...formattedOrder, ...partnerFields }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Error getting order:", error)
    return NextResponse.json({ error: "Failed to get order" }, { status: 500 })
  }
}

// Update an order
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const scope = await getOrderAdminScope(await getSession())

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const parsed = AdminOrderUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid order update" }, { status: 400 })
    }

    // Determine collection
    let collection = await getCollection<OrderDocument>("orders")
    let orderId
    try {
      orderId = createObjectId(id)
    } catch {
      orderId = null
    }

    let existingOrder = orderId ? await collection.findOne({ _id: orderId }) : await collection.findOne({ orderId: id })
    let isPartnerOrder = false

    if (!existingOrder) {
      collection = await getCollection<OrderDocument>("partner_orders")
      existingOrder = await collection.findOne({
        $or: [
          { orderId: id },
          { partnerOrderId: id },
          ...(orderId ? [{ _id: orderId }] : [])
        ]
      })
      if (!existingOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }
      isPartnerOrder = true
    }

    if (!orderWithinAdminScope(scope, existingOrder)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (existingOrder.storePayment?.status === "confirmation_pending" && parsed.data.status &&
      !["pending", "cancelled"].includes(parsed.data.status)) {
      return NextResponse.json({ error: "Approve the store payment before progressing this order" }, { status: 409 })
    }

    const now = new Date()
    const { carrier, cancellation, ...fields } = parsed.data
    const updateData = {
      ...fields,
      ...(carrier ? { "tracking.carrier": carrier } : {}),
      ...(cancellation ? { cancellation: { ...cancellation, date: now.toISOString() } } : {}),
      updatedAt: now,
    }
    const mutation: UpdateFilter<OrderDocument> = { $set: updateData }
    const statusChanged = !!updateData.status && updateData.status !== existingOrder.status

    if (statusChanged && updateData.status) {
      const statusDescriptions: Record<string, string> = {
        pending: "Your order is being processed",
        confirmed: "Your order has been confirmed",
        processing: "Your order is being prepared",
        shipped: "Your order has been shipped",
        delivered: "Your order has been delivered",
        cancelled: "Your order has been cancelled",
      }

      const newTimelineEntry = {
        date: new Date().toISOString(),
        status: updateData.status.charAt(0).toUpperCase() + updateData.status.slice(1),
        description: statusDescriptions[updateData.status] || "Order status updated",
      }

      if (isPartnerOrder) {
        const newHistoryEntry = {
          status: updateData.status,
          timestamp: now,
          details: { note: statusDescriptions[updateData.status] }
        }
        mutation.$push = { statusHistory: newHistoryEntry }
      } else {
        mutation.$push = { timeline: { $each: [newTimelineEntry], $position: 0 } }
      }
    }

    if (updateData.status === "shipped" && !updateData.trackingNumber &&
      !existingOrder.trackingNumber && !existingOrder.tracking?.trackingNumber && !isPartnerOrder) {
      return NextResponse.json({ error: "Tracking number is required when marking order as shipped" }, { status: 400 })
    }

    // Anchor for post-delivery journeys (review invites, accessory nudges).
    if (updateData.status && EARNING_STATUSES.some(status => status === updateData.status) && !existingOrder.deliveredAt) {
      mutation.$set = { ...mutation.$set, deliveredAt: now }
    }

    const updatedOrder = await collection.findOneAndUpdate({
      ...scope.filter,
      _id: existingOrder._id,
      status: existingOrder.status ?? { $exists: false },
      updatedAt: existingOrder.updatedAt ?? { $exists: false },
    }, mutation, { returnDocument: "after" })
    if (!updatedOrder) {
      return NextResponse.json({ error: "Order changed before this update; reload and try again" }, { status: 409 })
    }

    let emailSent: boolean | null = null

    if (statusChanged && updateData.status && existingOrder.customer?.email) {
      try {
        const templateId = getEmailTemplateId(updateData.status)
        const orderNumber = String(existingOrder.orderId || id)
        const emailData = {
          orderNumber,
          customerName: existingOrder.customer.name || "Customer",
          status: updateData.status,
          trackingNumber: updateData.trackingNumber || existingOrder.trackingNumber,
          orderDetails: {
            total: Number(existingOrder.total) || 0,
            items: existingOrder.items || [],
            shippingAddress: existingOrder.customer.address,
          },
          reason: updateData.cancellation?.reason,
          note: updateData.cancellation?.note,
        }
        const emailResult = await sendEmail({
          to: existingOrder.customer.email,
          subject: getEmailSubject(templateId, orderNumber),
          html: getEmailTemplate(templateId, emailData),
        })
        emailSent = emailResult.success
      } catch (emailError) {
        emailSent = false
        console.error("Order status notification failed:", emailError)
      }

    }

    if (statusChanged && updateData.status && existingOrder.userId) {
      void notifyOrderStatus(
        String(existingOrder.userId),
        String(existingOrder.orderId || id),
        updateData.status,
      ).catch(error => console.error("Order status push failed:", error))
    }

    const adminNotification = updateData.status === "confirmed"
      ? await notifyAdminOrder(existingOrder._id, isPartnerOrder ? "partner_orders" : "orders")
      : null

    // Reaching a value-realising status changes lifetime spend and tier, so refresh
    // the rollup now rather than waiting for the nightly rebuild. Never fatal.
    const customerId = String(existingOrder.userId || "")
    if (customerId && statusChanged && updateData.status && EARNING_STATUSES.some(status => status === updateData.status)) {
      try {
        await rebuildCustomerProfile(customerId)
        await recordEvent(customerId, "order_delivered", { orderId: id })
      } catch (profileError) {
        console.error("Profile rebuild after order update failed:", profileError)
      }

      // Points are minted here, after delivery — never at checkout.
      try {
        await awardPointsForOrder({
          userId: customerId,
          orderId: String(existingOrder.orderId || id),
          orderTotal: Number(existingOrder.total) || 0,
          status: updateData.status,
        })
      } catch (loyaltyError) {
        console.error("Loyalty award after order update failed:", loyaltyError)
      }
    }

    if (customerId && statusChanged && updateData.status && ["cancelled", "returned", "refunded"].includes(updateData.status)) {
      try {
        await reverseOrderPoints(customerId, String(existingOrder.orderId || id))
      } catch (loyaltyError) {
        console.error("Loyalty reversal after order update failed:", loyaltyError)
      }
    }

    const safeOrder = normalizeId(updatedOrder)
    delete safeOrder.guestAccessTokenHash
    return NextResponse.json({ ...safeOrder, notification: { emailSent, adminNotification } },
      { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Error updating order:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

// Delete an order
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const scope = await getOrderAdminScope(await getSession())

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    let collection = await getCollection("orders")
    let orderId
    try {
      orderId = createObjectId(id)
    } catch {
      orderId = null
    }

    const filter = { ...scope.filter, ...(orderId ? { _id: orderId } : { orderId: id }) }
    if (scope.kind === "none") return NextResponse.json({ error: "Order not found" }, { status: 404 })
    let result = await collection.deleteOne(filter)

    if (result.deletedCount === 0) {
      collection = await getCollection("partner_orders")
      result = await collection.deleteOne({
        ...scope.filter,
        $or: [
          { orderId: id },
          ...(orderId ? [{ _id: orderId }] : [])
        ]
      })
    }

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Order deleted successfully" })
  } catch (error) {
    console.error("Error deleting order:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
