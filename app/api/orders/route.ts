import { type NextRequest, NextResponse, after } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { getSession } from "@/lib/auth"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { createGuestAccessToken, hashGuestAccessToken } from "@/lib/guest-order"
import { redeemPoints, quoteRedemption, reverseOrderPoints } from "@/lib/loyalty"
import { generateOrderId } from "@/lib/order-id"
import { priceOrder, consumeOrderCoupon } from "@/lib/order-pricing"
import { verifyRazorpayPayment } from "@/lib/razorpay"
import { z } from "zod"
import { ObjectId } from "mongodb"
import { checkoutFingerprint, getCheckoutIntent, persistCheckoutOrder, CheckoutConflictError, type CheckoutIntent } from "@/lib/checkout-payment"
import { fulfillSoftwareOrder } from "@/lib/software-fulfillment"
import { queueExternalOrder, fulfillExternalOrder } from "@/lib/external-fulfillment"

export const dynamic = "force-dynamic"

interface OrderListDocument {
  id: string
  userId?: string
  orderId?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  status?: string
  total?: number
  subtotal?: number
  tax?: number
  shipping?: number
  coupon?: unknown
  items?: unknown[]
  customer?: { name?: string; [key: string]: unknown }
  shippingAddress?: unknown
  paymentMethod?: string
  paymentDetails?: unknown
  trackingNumber?: string
  timeline?: unknown[]
  externalQueue?: unknown
  notes?: string
}

function generateOrderNotes(orderData: Record<string, unknown>): string {
  const { items, customer, shippingAddress, paymentMethod, subtotal, tax, shipping, total, coupon } = orderData as {
    items: Array<Record<string, unknown>>
    customer: Record<string, string>
    shippingAddress?: Record<string, string>
    paymentMethod: string
    subtotal: number
    tax: number
    shipping: number
    total: number
    coupon?: { code: string; name: string; discount: number }
  }

  let notes = `=== ORDER DETAILS ===\n\n`

  notes += `CUSTOMER INFORMATION:\n`
  notes += `Name: ${customer.name || `${customer.firstName} ${customer.lastName}`}\n`
  notes += `Email: ${customer.email}\n`
  notes += `Phone: ${customer.phone || 'N/A'}\n`
  notes += `Address: ${customer.address || 'N/A'}\n`
  notes += `City: ${customer.city || 'N/A'}\n`
  notes += `State: ${customer.state || 'N/A'}\n`
  notes += `Zip Code: ${customer.zipCode || 'N/A'}\n`
  notes += `Country: ${customer.country || 'India'}\n\n`

  if (shippingAddress) {
    notes += `SHIPPING ADDRESS:\n`
    notes += `Name: ${shippingAddress.name || customer.name}\n`
    notes += `Street: ${shippingAddress.street || shippingAddress.address || customer.address}\n`
    notes += `City: ${shippingAddress.city || customer.city}\n`
    notes += `State: ${shippingAddress.state || customer.state}\n`
    notes += `Zip: ${shippingAddress.zip || customer.zipCode}\n`
    notes += `Country: ${shippingAddress.country || customer.country || 'India'}\n\n`
  }

  notes += `ORDER ITEMS:\n`
  items.forEach((item, index) => {
    notes += `${index + 1}. ${item.name}\n`
    notes += `   Type: ${item.type || 'hardware'}\n`
    notes += `   Price: ₹${Number(item.price).toLocaleString('en-IN')}\n`
    notes += `   Quantity: ${item.quantity}\n`

    if (item.type === 'software') {
      const maxDevices = item.maxDevices || item.packSize || 'Unlimited'
      const validity = item.validity || (item.validityYears ? `${item.validityYears} Year${Number(item.validityYears) > 1 ? 's' : ''}` : 'Lifetime')
      notes += `   Max Devices: ${maxDevices}\n`
      notes += `   Validity: ${validity}\n`
    }

    if (item.color) notes += `   Color: ${item.color}\n`
    if (item.size) notes += `   Size: ${item.size}\n`
    if (item.category) notes += `   Category: ${item.category}\n`
    notes += `   Subtotal: ₹${(Number(item.price) * Number(item.quantity)).toLocaleString('en-IN')}\n\n`
  })

  notes += `PRICING SUMMARY:\n`
  notes += `Subtotal: ₹${Number(subtotal).toLocaleString('en-IN')}\n`
  notes += `Tax: ₹${Number(tax).toLocaleString('en-IN')}\n`
  notes += `Shipping: ₹${Number(shipping).toLocaleString('en-IN')}\n`

  if (coupon) {
    notes += `Coupon Applied: ${coupon.code} (${coupon.name})\n`
    notes += `Discount: -₹${coupon.discount.toLocaleString('en-IN')}\n`
  }

  notes += `TOTAL: ₹${Number(total).toLocaleString('en-IN')}\n\n`
  notes += `PAYMENT METHOD: ${paymentMethod}\n\n`
  notes += `Order Created: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`

  return notes
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const isAdminRole = session.user.role === "admin" || session.user.role === "superadmin"
    const isStaff = !isAdminRole && session.user.dashboardAccess === true

    const employeeId = isAdminRole ? request.nextUrl.searchParams.get("employeeId") : null
    const limit = request.nextUrl.searchParams.get("limit")
    const couponCode = isAdminRole ? request.nextUrl.searchParams.get("couponCode") : null
    const couponUsageCount = isAdminRole ? request.nextUrl.searchParams.get("couponUsageCount") : null
    const userId = isAdminRole || isStaff ? request.nextUrl.searchParams.get("userId") : session.user.id

    if (couponUsageCount) {
      const codes = couponUsageCount.split(",").map((c) => c.trim().toUpperCase())
      const collection = await getCollection("orders")
      const counts: Record<string, number> = {}
      for (const code of codes) {
        counts[code] = await collection.countDocuments({ "coupon.code": code })
      }
      return NextResponse.json({ counts })
    }

    const collection = await getCollection("orders")

    let query: Record<string, unknown> = {}
    if (userId) query = { ...query, userId }
    if (isStaff) {
      const users = await getCollection("users")
      const user = ObjectId.isValid(session.user.id)
        ? await users.findOne({ _id: new ObjectId(session.user.id) })
        : await users.findOne({ email: session.user.email })
      const storeAccess = user?.storeAccess || "none"
      const storeIds = Array.isArray(user?.storeIds) ? user.storeIds.map(String) : []
      if (storeAccess !== "all") {
        query = storeAccess === "selected" && storeIds.length > 0
          ? { ...query, "fulfilment.storeId": { $in: storeIds } }
          : { ...query, _id: null }
      }
    }
    if (employeeId) {
      query = {
        ...query,
        $or: [
          { "paymentDetails.employeeId": employeeId },
          { "paymentDetails.verifiedEmail": employeeId },
          { employeeId }
        ]
      }
    }
    if (couponCode) query = { ...query, "coupon.code": couponCode.toUpperCase() }

    let ordersQuery = collection.find(query).sort({ createdAt: -1 })

    if (limit) {
      const limitNum = Number.parseInt(limit, 10)
      if (!isNaN(limitNum) && limitNum > 0) {
        ordersQuery = ordersQuery.limit(limitNum)
      }
    }

    const orders = await ordersQuery.toArray()

    const normalizedOrders = normalizeId(orders).map((order: OrderListDocument) => ({
      userId: order.userId || null,
      id: order.id,
      orderId: order.orderId || null,
      date: order.createdAt || new Date().toISOString(),
      status: order.status || "pending",
      total: order.total || 0,
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      shipping: order.shipping || 0,
      coupon: order.coupon || null,
      items: order.items || [],
      customer: order.customer || {},
      shippingAddress: order.shippingAddress || {
        name: order.customer?.name || "",
        street: "",
        city: "",
        state: "",
        zip: "",
        country: "India",
      },
      paymentMethod: order.paymentMethod || "cash",
      paymentDetails: order.paymentDetails || {},
      trackingNumber: order.trackingNumber || null,
      timeline: order.timeline || [
        {
          date: order.createdAt || new Date().toISOString(),
          status: "Order Placed",
          description: "Your order has been placed successfully",
        },
      ],
      externalQueue: order.externalQueue || null,
      notes: order.notes || null,
      source: "direct",
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt || new Date().toISOString(),
    }))

    let allOrders = normalizedOrders
    try {
      if (isAdminRole && !userId && !employeeId && !couponCode) {
        const partnerOrdersCollection = await getCollection("partner_orders")
        const partnerOrders = await partnerOrdersCollection.find({}).sort({ createdAt: -1 }).toArray()

        const partnerIds = [...new Set(partnerOrders.map((po) => po.partnerId).filter(Boolean))]
        const partnerNameMap: Record<string, string> = {}
        if (partnerIds.length > 0) {
          try {
            const partnersCollection = await getCollection("partners")
            const partners = await partnersCollection.find({ id: { $in: partnerIds } }).toArray()
            partners.forEach((p) => {
              partnerNameMap[p.id] = p.name || p.email || 'Unknown Partner'
            })
          } catch {
            // partner lookup failure — continue without names
          }
        }

        const normalizedPartnerOrders = partnerOrders.map((po) => ({
          userId: po.partnerId || null,
          id: po._id?.toString() || po.orderId,
          orderId: po.orderId,
          date: po.createdAt || new Date().toISOString(),
          status: po.status || "pending",
          total: po.summary?.total || 0,
          subtotal: po.summary?.subtotal || 0,
          tax: po.summary?.tax || 0,
          shipping: po.summary?.shipping || 0,
          coupon: null,
          items: (po.items || []).map((item: Record<string, unknown>) => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            type: 'product',
          })),
          customer: po.customer || {},
          shippingAddress: po.customer?.address ? {
            name: po.customer.name || "",
            street: po.customer.address.line1 || "",
            city: po.customer.address.city || "",
            state: po.customer.address.state || "",
            zip: po.customer.address.pincode || "",
            country: po.customer.address.country || "India",
          } : {},
          paymentMethod: po.paymentMethod || "partner",
          paymentDetails: {},
          trackingNumber: po.tracking?.trackingNumber || null,
          timeline: (po.statusHistory || []).map((sh: Record<string, unknown>) => ({
            date: sh.timestamp || new Date().toISOString(),
            status: sh.status,
            description: sh.note || `Order ${sh.status}`,
          })),
          externalQueue: null,
          notes: po.notes || null,
          source: "partner",
          partnerId: po.partnerId,
          partnerName: partnerNameMap[po.partnerId] || po.partnerId || "Unknown",
          partnerOrderId: po.partnerOrderId || null,
          commission: po.commission || null,
          razorpayPaymentDetails: po.paymentDetails || null,
          paymentVerification: po.paymentVerification || { verified: false },
          createdAt: po.createdAt || new Date().toISOString(),
          updatedAt: po.updatedAt || new Date().toISOString(),
        }))

        allOrders = [...normalizedOrders, ...normalizedPartnerOrders].sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        if (limit) {
          const limitNum = Number.parseInt(limit, 10)
          if (!isNaN(limitNum) && limitNum > 0) {
            allOrders = allOrders.slice(0, limitNum)
          }
        }
      }
    } catch {
      // partner orders fetch failed — continue with regular orders only
    }

    return NextResponse.json(allOrders, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error("[Orders GET]", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to get orders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const isGuest = !session?.user?.id

    // Guests are unauthenticated, so this endpoint becomes publicly writable.
    // Cap it per-IP to keep order spam and coupon probing bounded.
    if (isGuest) {
      const limit = await checkRateLimit(request, RATE_LIMITS.ORDERS)
      if (!limit.success) {
        return NextResponse.json(
          { error: RATE_LIMITS.ORDERS.message },
          { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 60) } },
        )
      }
    }

    const body = await request.json()

    // Only identifiers, quantities and delivery details are accepted from the client.
    // Prices, totals, coupon value and order status are always derived server-side.
    const orderSchema = z.object({
      items: z.array(z.object({
        id: z.string().optional(),
        productId: z.string().optional(),
        sku: z.string().nullish(),
        quantity: z.union([z.number(), z.string()]),
        type: z.string().nullish(),
        // The cart sends these as explicit nulls for non-integration items, and the
        // software fields arrive as numbers, so both shapes must be accepted.
        provider: z.string().nullish(),
        source: z.string().nullish(),
        kgenProductId: z.string().nullish(),
        externalProductId: z.string().nullish(),
        kgenVariantId: z.string().nullish(),
        externalVariantId: z.string().nullish(),
        packSize: z.union([z.string(), z.number()]).nullish(),
        validityYears: z.union([z.string(), z.number()]).nullish(),
        maxDevices: z.union([z.string(), z.number()]).nullish(),
        validity: z.string().nullish(),
        color: z.string().nullish(),
        size: z.string().nullish(),
      })).min(1, 'Order must contain at least one item'),
      customer: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        name: z.string().optional(),
        email: z.string().email('Invalid email'),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
      }),
      shippingAddress: z.object({
        name: z.string().optional(),
        street: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
      }).optional(),
      paymentMethod: z.enum(["cash", "cod", "cash-on-delivery", "online", "razorpay", "instore"]).optional(),
      paymentDetails: z.record(z.unknown()).optional(),
      fulfilment: z.object({
        method: z.enum(["delivery", "pickup"]),
        storeId: z.string().optional(),
        storeName: z.string().optional(),
        storeAddress: z.string().optional(),
        storePhone: z.string().optional(),
      }).optional(),
      coupon: z.object({ code: z.string() }).nullish(),
      redeemPoints: z.number().int().min(0).max(1_000_000).optional(),
    })

    const parsed = orderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { items, customer, shippingAddress, paymentMethod, paymentDetails } = parsed.data
    const userId = session?.user?.id ?? null

    // A guest order can only be traced back through the contact details, so both
    // are mandatory when there is no account behind it.
    if (isGuest && !/^[0-9]{10}$/.test(String(customer.phone || "").trim())) {
      return NextResponse.json(
        { error: "A valid 10-digit phone number is required to check out as a guest" },
        { status: 400 },
      )
    }

    const pricing = await priceOrder(items, {
      couponCode: parsed.data.coupon?.code ?? null,
      userId,
      fulfilment: parsed.data.fulfilment,
    })
    if (!pricing.ok) {
      return NextResponse.json({ error: pricing.error }, { status: 400 })
    }

    const { items: validatedItems, subtotal, tax, shipping, total, coupon } = pricing

    // Quote the rewards discount before payment verification, because the
    // customer was charged the reduced amount. Guests cannot redeem.
    let loyalty: { pointsRedeemed: number; discount: number } | null = null
    if (userId && parsed.data.redeemPoints && parsed.data.redeemPoints > 0) {
      const quote = await quoteRedemption({
        userId,
        points: parsed.data.redeemPoints,
        orderTotal: total,
      })
      if (!quote.ok) {
        return NextResponse.json({ error: quote.error }, { status: 400 })
      }
      loyalty = { pointsRedeemed: quote.points, discount: quote.discount }
    }

    const payableTotal = Math.max(0, total - (loyalty?.discount ?? 0))
    // An order only reaches a paid state once the payment is confirmed server-side.
    const method = paymentMethod || "cash"
    let status = "pending"
    let paymentVerification: Record<string, unknown> = { verified: false, method }
    let checkoutIntent: CheckoutIntent | null = null
    const fingerprint = checkoutFingerprint(pricing, parsed.data, payableTotal)

    if (method === "online" || method === "razorpay") {
      const paymentId = paymentDetails?.paymentId || paymentDetails?.transactionId
      const paymentOrderId = paymentDetails?.orderId
      const checkoutToken = paymentDetails?.checkoutToken
      if (typeof paymentId !== "string" || typeof paymentOrderId !== "string" || typeof checkoutToken !== "string") {
        return NextResponse.json({ error: "Verified checkout reference is required" }, { status: 400 })
      }
      checkoutIntent = await getCheckoutIntent(paymentOrderId, checkoutToken, userId)
      if (!checkoutIntent || checkoutIntent.method !== "razorpay" || checkoutIntent.status !== "verified" ||
        checkoutIntent.paymentId !== paymentId || checkoutIntent.fingerprint !== fingerprint ||
        checkoutIntent.amount !== Math.round(payableTotal * 100)) {
        return NextResponse.json({ error: "Checkout is mismatched, expired or already completed" }, { status: 409 })
      }
      const check = await verifyRazorpayPayment(paymentId, payableTotal, paymentOrderId)
      if (!check.verified) {
        return NextResponse.json({ error: "Payment could not be verified", reason: check.reason }, { status: check.reason === "verification_error" ? 503 : 400 })
      }
      paymentVerification = {
        verified: true,
        method,
        razorpayPaymentId: paymentId,
        razorpayOrderId: paymentOrderId,
        amountPaid: check.amountPaid ?? null,
        reason: check.reason ?? null,
        checkedAt: new Date(),
      }
      status = "confirmed"
    } else if (method === "instore") {
      const approvalId = paymentDetails?.approvalId
      const approvalToken = paymentDetails?.approvalToken
      if (typeof approvalId !== "string" || typeof approvalToken !== "string") {
        return NextResponse.json({ error: "Employee purchase approval is required" }, { status: 400 })
      }
      checkoutIntent = await getCheckoutIntent(approvalId, approvalToken, userId)
      if (!checkoutIntent || checkoutIntent.method !== "instore" || checkoutIntent.status !== "verified" ||
        checkoutIntent.fingerprint !== fingerprint || checkoutIntent.amount !== Math.round(payableTotal * 100)) {
        return NextResponse.json({ error: "Purchase approval is mismatched, expired or already used" }, { status: 409 })
      }
      const employees = await getCollection("employees")
      const employee = await employees.findOne({
        employeeId: checkoutIntent.employeeId, email: checkoutIntent.employeeEmail, status: "active",
      })
      if (!employee) return NextResponse.json({ error: "Approving employee is no longer active" }, { status: 403 })
      paymentVerification = {
        verified: true,
        method,
        employeeId: checkoutIntent.employeeId,
        approvalId: checkoutIntent._id,
        checkedAt: new Date(),
      }
      status = "confirmed"
    }

    const orderId = await generateOrderId()

    // Guests get a one-time capability token; order ids are sequential and so
    // are never sufficient on their own to read an order.
    const guestAccessToken = isGuest ? createGuestAccessToken() : null

    const newOrder = {
      orderId,
      userId,
      isGuest,
      ...(guestAccessToken
        ? { guestAccessTokenHash: hashGuestAccessToken(guestAccessToken) }
        : {}),
      items: validatedItems,
      customer: {
        firstName: customer.firstName || "",
        lastName: customer.lastName || "",
        name: customer.name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
        email: customer.email,
        phone: customer.phone || null,
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        zipCode: customer.zipCode || "",
        country: customer.country || "India",
      },
      shippingAddress: shippingAddress || {
        name: customer.name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
        street: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        zip: customer.zipCode || "",
        country: customer.country || "India",
      },
      paymentMethod: method,
      paymentDetails: {
        method,
        status: paymentVerification.verified ? "completed" : "pending",
        ...(checkoutIntent?.method === "razorpay" ? { paymentId: checkoutIntent.paymentId, orderId: checkoutIntent._id } : {}),
        ...(checkoutIntent?.method === "instore" ? { employeeId: checkoutIntent.employeeId, verifiedEmail: checkoutIntent.employeeEmail } : {}),
      },
      paymentVerification,
      // Store pickup is recorded here; reserving the unit against store stock
      // waits on the SAP inventory feed (see docs/brd/PENDING-EXTERNAL-INTEGRATIONS.md).
      fulfilment: parsed.data.fulfilment ?? { method: "delivery" },
      subtotal,
      tax,
      shipping,
      total: payableTotal,
      loyalty,
      status,
      trackingNumber: null,
      coupon,
      notes: "",
      timeline: [
        {
          date: new Date().toISOString(),
          status: "Order Placed",
          description: "Your order has been placed successfully",
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const orderNotes = generateOrderNotes({
      items: validatedItems,
      customer: newOrder.customer,
      shippingAddress: newOrder.shippingAddress,
      paymentMethod: newOrder.paymentMethod,
      subtotal: newOrder.subtotal,
      tax: newOrder.tax,
      shipping: newOrder.shipping,
      total: newOrder.total,
      coupon: newOrder.coupon,
    })

    newOrder.notes = orderNotes

    const insertedId = await persistCheckoutOrder(newOrder, checkoutIntent, async (transaction) => {
      if (coupon) {
        const consumption = await consumeOrderCoupon(items, coupon, userId, transaction)
        if (!consumption.ok) throw new CheckoutConflictError(consumption.error)
      }
      if (userId && loyalty) {
        const redemption = await redeemPoints({
          userId, orderId, points: loyalty.pointsRedeemed, orderTotal: total, session: transaction,
        })
        if (!redemption.ok) throw new CheckoutConflictError(redemption.error)
      }
    })
    const result = { insertedId }

    const softwareItems = validatedItems.filter((item) => item.type === 'software')

    if (softwareItems.some((item) => !item.provider) && paymentVerification.verified) {
      after(async () => {
        try {
          await fulfillSoftwareOrder(insertedId.toString())
        } catch (error) {
          console.error("[Orders] Software fulfillment requires administrator attention", error)
          await (await getCollection("orders")).updateOne({ _id: insertedId }, {
            $set: { licenseFulfillment: { status: "needs_inventory", updatedAt: new Date() } },
          })
        }
      })
    }

    const { guestAccessTokenHash: _guestAccessTokenHash, ...orderWithoutSecrets } = newOrder
    const orderForResponse = {
      id: orderId,
      ...orderWithoutSecrets
    }

    try {
      const { sendEmail } = await import("@/lib/email")
      const { emailTemplates } = await import("@/lib/emailTemplates")

      const customerEmail = newOrder.customer.email || customer?.email

      if (customerEmail) {
        const customerName = newOrder.customer.name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer"

        const emailData = {
          orderNumber: orderId,
          customerName,
          status: newOrder.status || "pending",
          orderDetails: {
            total: payableTotal,
            items: validatedItems.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            })),
            shippingAddress: `${((newOrder.shippingAddress as Record<string, string>)?.name || customerName)}\n${((newOrder.shippingAddress as Record<string, string>)?.street || (newOrder.customer as Record<string, string>)?.address || "")}\n${((newOrder.shippingAddress as Record<string, string>)?.city || (newOrder.customer as Record<string, string>)?.city || "")}, ${((newOrder.shippingAddress as Record<string, string>)?.state || (newOrder.customer as Record<string, string>)?.state || "")} ${((newOrder.shippingAddress as Record<string, string>)?.zip || (newOrder.customer as Record<string, string>)?.zipCode || "")}\n${((newOrder.shippingAddress as Record<string, string>)?.country || (newOrder.customer as Record<string, string>)?.country || "India")}`,
          },
        }

        await sendEmail({
          to: customerEmail,
          subject: emailTemplates.ORDER_PENDING.subject.replace("#{orderNumber}", orderId),
          html: emailTemplates.ORDER_PENDING.html(emailData),
        })

        // A guest has no order history to sign in to, so the capability link is
        // the only way back to this order. Send it separately from the template.
        if (guestAccessToken) {
          const origin =
            process.env.NEXT_PUBLIC_SITE_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
          const orderUrl = `${origin}/order/${orderId}?token=${encodeURIComponent(guestAccessToken)}`

          await sendEmail({
            to: customerEmail,
            subject: `Your order link — ${orderId}`,
            html:
              `<p>Hi ${customerName},</p>` +
              `<p>You checked out as a guest, so here is your private link to view order <strong>${orderId}</strong>:</p>` +
              `<p><a href="${orderUrl}">${orderUrl}</a></p>` +
              `<p>Keep this link private — anyone with it can view the order. ` +
              `Create an account with this email address to keep your full order history.</p>`,
          })
        }
      }
    } catch {
      // email failure should not fail order creation
    }

    try {
      const { sendEmail, getVendorOrderNotificationTemplate } = await import("@/lib/email")
      const employeesCollection = await getCollection("employees")
      const adminEmployees = await employeesCollection
        .find({ dashboardAccess: true, status: "active", allowedPages: "/admin/orders" })
        .toArray()

      const adminOrder = normalizeId(orderForResponse)

      if (adminEmployees && adminEmployees.length > 0) {
        for (const emp of adminEmployees) {
          try {
            if (!emp.email) continue
            const subject = `Admin Copy - New Order #${orderId}`
            const html = getVendorOrderNotificationTemplate(adminOrder)
            await sendEmail({ to: emp.email, subject, html })
          } catch {
            // per-employee email failure — non-critical
          }
        }
      }

      try {
        const settingsCollection = await getCollection("settings")
        const settingsDoc = await settingsCollection.findOne({})
        const superAdminEmail = settingsDoc?.storeEmail

        if (superAdminEmail) {
          const subject = `Super Admin Copy - New Order #${orderId}`
          const html = getVendorOrderNotificationTemplate(adminOrder)
          await sendEmail({ to: superAdminEmail, subject, html })
        }
      } catch {
        // super admin email failure — non-critical
      }
    } catch {
      // admin email notification failure — non-critical
    }

    try {
      if (result.insertedId && userId) {
        const cartCollection = await getCollection("carts")
        await cartCollection.updateOne({ userId }, { $set: { items: [] } }, { upsert: false })
      }
    } catch {
      // cart clearing failure — non-critical
    }

    const hasExternalItems = validatedItems.some((item) => item.provider === "exlr8" || item.source === "kgen" || item.kgenProductId)
    if (hasExternalItems && paymentVerification.verified) {
      after(async () => {
        try {
          await queueExternalOrder(insertedId.toString())
          await fulfillExternalOrder(insertedId.toString())
        } catch (error) {
          console.error("[Orders] External fulfillment remains queued or requires reconciliation", error)
        }
      })
    }

    return NextResponse.json({
      success: true,
      orderId: orderId,
      order: normalizeId(orderForResponse),
      // Returned exactly once. The client stores it so a guest can reopen the order.
      ...(guestAccessToken ? { guestAccessToken } : {}),
    })
  } catch (error) {
    if (error instanceof CheckoutConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("[Orders POST]", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
