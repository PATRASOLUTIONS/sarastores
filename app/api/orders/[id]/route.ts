import { type NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId, createObjectId } from "@/lib/db-service"
import { getEmailTemplate, getEmailSubject, getEmailTemplateId } from "@/lib/emailTemplates"
import { sendEmail } from "@/lib/email"
import { requireAdmin, checkAdminAuthorization, getSession } from "@/lib/auth"
import { verifyGuestAccessToken } from "@/lib/guest-order"
import { rebuildCustomerProfile, recordEvent, EARNING_STATUSES } from "@/lib/customer-profile"
import { awardPointsForOrder, reverseOrderPoints } from "@/lib/loyalty"

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
    console.log("-----------------------------------------")
    console.log("!!! API ORDER DETAIL - VERSION 2.3 !!!")
    console.log("Order ID Search:", id)
    console.log("-----------------------------------------")

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json(
        { error: "Invalid order ID provided" },
        { status: 400 }
      )
    }

    let collection = await getCollection("orders")
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
      const partnerCollection = await getCollection("partner_orders")
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
    const { authorized: isAdminUser } = session ? await checkAdminAuthorization() : { authorized: false }
    const ownerId = normalizedOrder.userId || normalizedOrder.customerId || null
    const isOwner = !!session && !!ownerId && String(ownerId) === session.user.id
    const isGuestHolder =
      !ownerId && verifyGuestAccessToken(guestToken, order.guestAccessTokenHash)

    if (!isAdminUser && !isOwner && !isGuestHolder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Default format for main orders
    let formattedOrder: any = {
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
      trackingNumber: normalizedOrder.trackingNumber || (normalizedOrder.tracking?.trackingNumber) || null,
      timeline: normalizedOrder.timeline || (normalizedOrder.statusHistory || []).map((sh: any) => ({
        date: sh.timestamp || new Date().toISOString(),
        status: sh.status,
        description: sh.details?.note || `Order ${sh.status}`,
      })),
      notes: normalizedOrder.notes || null,
      source: source,
      createdAt: normalizedOrder.createdAt || new Date().toISOString(),
      updatedAt: normalizedOrder.updatedAt || new Date().toISOString(),
    }

    // Add partner specific fields
    if (source === 'partner') {
      formattedOrder.partnerId = normalizedOrder.partnerId
      formattedOrder.partnerOrderId = normalizedOrder.partnerOrderId
      formattedOrder.commission = typeof normalizedOrder.commission === 'object'
        ? (normalizedOrder.commission.amount || 0)
        : (normalizedOrder.commission || 0)
      formattedOrder.razorpayPaymentDetails = normalizedOrder.paymentDetails
      formattedOrder.paymentVerification = normalizedOrder.paymentVerification || { verified: false }

      // Fetch partner name
      try {
        const partnersCol = await getCollection("partners")
        const partner = await partnersCol.findOne({ id: normalizedOrder.partnerId })
        if (partner) {
          formattedOrder.partnerName = partner.name
        }
      } catch (e) {
        console.warn("Failed to fetch partner name for order detail")
      }
    }

    return NextResponse.json(formattedOrder)
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

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Determine collection
    let collection = await getCollection("orders")
    let orderId
    try {
      orderId = createObjectId(id)
    } catch {
      orderId = null
    }

    let existingOrder = orderId ? await collection.findOne({ _id: orderId }) : await collection.findOne({ orderId: id })
    let isPartnerOrder = false

    if (!existingOrder) {
      collection = await getCollection("partner_orders")
      existingOrder = await collection.findOne({
        $or: [
          { orderId: id },
          ...(orderId ? [{ _id: orderId }] : [])
        ]
      })
      if (!existingOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }
      isPartnerOrder = true
    }

    const { id: _, _id, ...updateData } = body
    updateData.updatedAt = new Date()

    if (updateData.status) {
      const existingTimeline = isPartnerOrder
        ? (existingOrder.statusHistory || []).map((sh: any) => ({
          date: sh.timestamp,
          status: sh.status,
          description: sh.details?.note
        }))
        : (existingOrder.timeline || [])

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
        // Map back to partner_orders schema if needed, but for simplicity we'll just use statusHistory
        const newHistoryEntry = {
          status: updateData.status,
          timestamp: new Date(),
          details: { note: statusDescriptions[updateData.status] }
        }
        updateData.statusHistory = [...(existingOrder.statusHistory || []), newHistoryEntry]
      } else {
        existingTimeline.unshift(newTimelineEntry)
        updateData.timeline = existingTimeline
      }
    }

    if (updateData.status === "shipped" && !updateData.trackingNumber && !isPartnerOrder) {
      return NextResponse.json({ error: "Tracking number is required when marking order as shipped" }, { status: 400 })
    }

    // Anchor for post-delivery journeys (review invites, accessory nudges).
    if (EARNING_STATUSES.includes(updateData.status) && !existingOrder.deliveredAt) {
      updateData.deliveredAt = new Date()
    }

    const filter = orderId ? { _id: orderId } : { orderId: id }
    const result = await collection.updateOne(filter, { $set: updateData })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const updatedOrder = await collection.findOne(filter)
    let emailSent: boolean | null = null

    if (updateData.status && updateData.status !== existingOrder.status && existingOrder.customer?.email) {
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

    // Reaching a value-realising status changes lifetime spend and tier, so refresh
    // the rollup now rather than waiting for the nightly rebuild. Never fatal.
    const customerId = String(existingOrder.userId || "")
    if (customerId && EARNING_STATUSES.includes(updateData.status)) {
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

    if (customerId && ["cancelled", "returned", "refunded"].includes(updateData.status)) {
      try {
        await reverseOrderPoints(customerId, String(existingOrder.orderId || id))
      } catch (loyaltyError) {
        console.error("Loyalty reversal after order update failed:", loyaltyError)
      }
    }

    return NextResponse.json({ ...normalizeId(updatedOrder), notification: { emailSent } })
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

    let filter = orderId ? { _id: orderId } : { orderId: id }
    let result = await collection.deleteOne(filter)

    if (result.deletedCount === 0) {
      collection = await getCollection("partner_orders")
      result = await collection.deleteOne({
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
