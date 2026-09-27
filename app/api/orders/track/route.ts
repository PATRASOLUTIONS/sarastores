import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

const STATUS_MAP: Record<string, { key: string; label: string }> = {
  pending: { key: "ordered", label: "Order Placed" },
  confirmed: { key: "processing", label: "Order Confirmed" },
  processing: { key: "processing", label: "Processing" },
  packed: { key: "shipped", label: "Packed" },
  shipped: { key: "transit", label: "Shipped" },
  in_transit: { key: "transit", label: "In Transit" },
  out_for_delivery: { key: "out_for_delivery", label: "Out for Delivery" },
  delivered: { key: "delivered", label: "Delivered" },
  cancelled: { key: "ordered", label: "Cancelled" },
  returned: { key: "ordered", label: "Returned" },
}

function buildTimeline(order: Record<string, unknown>) {
  const events: Array<{ status: string; location: string; timestamp: string; description: string }> = []
  const status = (order.status as string) || "pending"
  const createdAt = order.createdAt ? new Date(order.createdAt as string) : new Date()
  const shipping = (order.shippingAddress || {}) as Record<string, string>
  const city = shipping.city || (order.city as string) || "Bengaluru"
  const destCity = shipping.city || "Your City"

  events.push({
    status: "Order Placed",
    location: city,
    timestamp: createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    description: "Your order has been placed successfully.",
  })

  if (["confirmed", "processing", "packed", "shipped", "in_transit", "out_for_delivery", "delivered"].includes(status)) {
    events.unshift({
      status: "Order Confirmed",
      location: city,
      timestamp: new Date(createdAt.getTime() + 30 * 60000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      description: "Payment verified. Your order is being prepared.",
    })
  }
  if (["processing", "packed", "shipped", "in_transit", "out_for_delivery", "delivered"].includes(status)) {
    events.unshift({
      status: "Processing",
      location: "Warehouse, " + city,
      timestamp: new Date(createdAt.getTime() + 2 * 3600000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      description: "Items are being picked and packed at our warehouse.",
    })
  }
  if (["packed", "shipped", "in_transit", "out_for_delivery", "delivered"].includes(status)) {
    events.unshift({
      status: "Shipped",
      location: "Distribution Center, " + city,
      timestamp: new Date(createdAt.getTime() + 24 * 3600000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      description: `Package handed to ${order.carrier || "delivery partner"}. Tracking: ${order.trackingNumber || "Pending"}`,
    })
  }
  if (["in_transit", "out_for_delivery", "delivered"].includes(status)) {
    events.unshift({
      status: "In Transit",
      location: "Transit Hub",
      timestamp: new Date(createdAt.getTime() + 48 * 3600000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      description: "Your package is on its way to your city.",
    })
  }
  if (["out_for_delivery", "delivered"].includes(status)) {
    events.unshift({
      status: "Out for Delivery",
      location: destCity,
      timestamp: new Date(createdAt.getTime() + 72 * 3600000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      description: "Your package is on the delivery vehicle and will arrive today.",
    })
  }
  if (status === "delivered") {
    events.unshift({
      status: "Delivered",
      location: destCity,
      timestamp: order.deliveredAt
        ? new Date(order.deliveredAt as string).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : new Date(createdAt.getTime() + 96 * 3600000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      description: "Package delivered successfully. Thank you for shopping with us!",
    })
  }

  return events
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("orderId")
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const orders = db.collection("orders")
    const partnerOrders = db.collection("partner_orders")

    const raw = orderId.trim()
    const clean = raw.replace(/^#/, "")

    // Build all possible query conditions upfront, then execute as a single $or
    const conditions: Record<string, unknown>[] = []

    // SARAECOM order ID
    if (clean.startsWith("SARAECOM-")) {
      conditions.push({ orderId: clean })
    }

    // MongoDB ObjectId
    if (ObjectId.isValid(clean)) {
      conditions.push({ _id: new ObjectId(clean) })
    }

    // Razorpay order ID
    if (clean.startsWith("order_")) {
      conditions.push({ razorpayOrderId: clean })
      conditions.push({ "paymentDetails.orderId": clean })
    }

    // Razorpay payment ID
    if (clean.startsWith("pay_")) {
      conditions.push({ paymentId: clean })
      conditions.push({ "paymentDetails.paymentId": clean })
      conditions.push({ "paymentDetails.transactionId": clean })
    }

    // Partner order ID
    if (clean.startsWith("PO-")) {
      conditions.push({ orderId: clean })
    }

    // Generic fallbacks
    conditions.push({ paymentId: clean })
    conditions.push({ razorpayOrderId: clean })
    conditions.push({ "paymentDetails.paymentId": clean })
    conditions.push({ "paymentDetails.transactionId": clean })
    conditions.push({ "paymentDetails.orderId": clean })
    conditions.push({ _id: clean } as Record<string, unknown>)
    conditions.push({ orderNumber: clean })

    // Email or phone lookup
    if (clean.includes("@")) {
      conditions.push({ "customer.email": clean })
    }
    if (/^\d{10}$/.test(clean)) {
      conditions.push({ "customer.phone": clean })
    }

    // Single query with $or instead of 15+ sequential findOne() calls
    let order = await orders.findOne({ $or: conditions })

    // Fallback to partner_orders for SARAECOM and PO- prefixes
    if (!order && (clean.startsWith("SARAECOM-") || clean.startsWith("PO-"))) {
      order = await partnerOrders.findOne({ $or: [{ orderId: clean }] })
    }

    if (!order) {
      return NextResponse.json({
        error: "Order not found. Please check your order ID and try again.",
        hint: "Try entering: the order ID from your confirmation email (with or without #), Razorpay payment ID (pay_...), or your registered email/phone.",
      }, { status: 404 })
    }

    const statusKey = STATUS_MAP[order.status]?.key || "ordered"
    const timeline = buildTimeline(order)

    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date()
    const estDelivery = new Date(createdAt.getTime() + 7 * 24 * 3600000)

    return NextResponse.json({
      tracking: {
        orderId: order.orderId || order._id.toString(),
        trackingNumber: order.trackingNumber || "Will be assigned after dispatch",
        carrier: order.carrier || "Partner Logistics",
        currentStatus: statusKey,
        estimatedDelivery: estDelivery.toLocaleDateString("en-IN", { dateStyle: "medium" }),
        origin: order.originCity || "Bengaluru",
        destination: order.shippingAddress?.city || order.city || "Your City",
        events: timeline,
      },
    })
  } catch (error) {
    console.error("Track order error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
