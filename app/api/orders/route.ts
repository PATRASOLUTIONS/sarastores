import { type NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { getSession } from "@/lib/auth"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { createGuestAccessToken, hashGuestAccessToken } from "@/lib/guest-order"
import { redeemPoints, quoteRedemption, reverseOrderPoints } from "@/lib/loyalty"
import { generateOrderId } from "@/lib/order-id"
import { priceOrder } from "@/lib/order-pricing"
import { verifyRazorpayPayment } from "@/lib/razorpay"
import { z } from "zod"
import { ObjectId } from "mongodb"

export const dynamic = "force-dynamic"

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

    const normalizedOrders = normalizeId(orders).map((order) => ({
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
      paymentMethod: z.string().optional(),
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

    if (method === "online" || method === "razorpay") {
      const razorpayPaymentId =
        (paymentDetails?.paymentId as string) || (paymentDetails?.transactionId as string) || ""
      if (!razorpayPaymentId) {
        return NextResponse.json({ error: "Payment reference missing" }, { status: 400 })
      }
      const check = await verifyRazorpayPayment(razorpayPaymentId, payableTotal)
      paymentVerification = {
        verified: check.verified,
        method,
        razorpayPaymentId,
        amountPaid: check.amountPaid ?? null,
        reason: check.reason ?? null,
        checkedAt: new Date(),
      }
      if (check.verified) {
        status = "confirmed"
      } else {
        console.warn(
          `[Orders POST] unverified online payment ${razorpayPaymentId} for user ${userId}: ${check.reason}`,
        )
      }
    } else if (method === "instore") {
      const employeeId = String(paymentDetails?.employeeId || "").trim()
      const verifiedEmail = String(paymentDetails?.verifiedEmail || "").trim()
      const employees = await getCollection("employees")
      const employee = employeeId
        ? await employees.findOne({ employeeId, status: "active" })
        : null
      const emailMatches = !verifiedEmail || employee?.email === verifiedEmail
      const verified = !!employee && emailMatches
      paymentVerification = {
        verified,
        method,
        employeeId: employeeId || null,
        reason: verified ? null : "employee_not_verified",
        checkedAt: new Date(),
      }
      if (verified) status = "confirmed"
    }

    const collection = await getCollection("orders")
    const orderId = await generateOrderId()

    // Guests get a one-time capability token; order ids are sequential and so
    // are never sufficient on their own to read an order.
    const guestAccessToken = isGuest ? createGuestAccessToken() : null

    // Commit the debit now that the order id exists. A failure here must not
    // hand out a discount for free, so the order is rejected.
    if (userId && loyalty) {
      const redemption = await redeemPoints({
        userId,
        orderId,
        points: loyalty.pointsRedeemed,
        orderTotal: total,
      })
      if (!redemption.ok) {
        return NextResponse.json({ error: redemption.error }, { status: 400 })
      }
    }

    const newOrder: Record<string, unknown> = {
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
      paymentDetails: paymentDetails || {},
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
      customer: newOrder.customer as Record<string, string>,
      shippingAddress: newOrder.shippingAddress as Record<string, string>,
      paymentMethod: newOrder.paymentMethod as string,
      subtotal: newOrder.subtotal as number,
      tax: newOrder.tax as number,
      shipping: newOrder.shipping as number,
      total: newOrder.total as number,
      coupon: newOrder.coupon as { code: string; name: string; discount: number } | undefined,
    })

    newOrder.notes = orderNotes

    const result = await collection.insertOne(newOrder)
    const insertedId = result.insertedId.toString()

    const softwareItems = validatedItems.filter((item) => item.type === 'software')

    if (softwareItems.length > 0) {
      try {
        const proto = request.headers.get('x-forwarded-proto') || (request.headers.get('referer')?.split(':')[0]) || 'http'
        const host = request.headers.get('host') || 'localhost:3000'
        const origin = `${proto}://${host}`

        for (const item of softwareItems) {
          try {
            if (item.provider) continue

            const qty = Number(item.quantity || 1)
            const validityYears = item.validityYears ? Number(item.validityYears) : undefined
            const validityDays = item.validity ? Number(item.validity) : (validityYears ? validityYears * 365 : undefined)

            const assignPayload = {
              softwareId: item.kgenProductId || item.id,
              validity: validityDays,
              validityYears: validityYears,
              maxDevices: item.maxDevices || 1,
              quantity: qty
            }

            try {
              const resp = await fetch(`${origin}/api/orders/${orderId}/assign-license`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assignPayload)
              })
              await resp.json().catch(() => null)
            } catch {
              // assign-license network error — non-critical
            }
          } catch {
            // per-item error — continue with next item
          }
        }
      } catch {
        // license delegation error — non-critical
      }
    }

    const { guestAccessTokenHash: _guestAccessTokenHash, ...orderWithoutSecrets } = newOrder
    const orderForResponse = {
      id: orderId,
      ...orderWithoutSecrets
    }

    try {
      const { sendEmail } = await import("@/lib/email")
      const { emailTemplates } = await import("@/lib/emailTemplates")

      const customerEmail = (newOrder.customer as Record<string, string>)?.email || customer?.email

      if (customerEmail) {
        const customerName = (newOrder.customer as Record<string, string>)?.name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer"

        const emailData = {
          orderNumber: orderId,
          customerName,
          status: (newOrder.status as string) || "pending",
          orderDetails: {
            total: newOrder.total,
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

    try {
      const integrationItems = validatedItems.filter((it) => (it.provider && it.provider === 'exlr8') || it.source === 'kgen' || it.kgenProductId)
      if (integrationItems.length > 0) {
        const proto = request.headers.get('x-forwarded-proto') || (request.headers.get('referer')?.split(':')[0]) || 'http'
        const host = request.headers.get('host') || 'localhost:3000'
        const origin = `${proto}://${host}`

        const isConfirmed = (newOrder.status === 'confirmed' || newOrder.status === 'paid' || (newOrder.paymentDetails as Record<string, unknown>)?.status === 'completed')

        if (isConfirmed) {
          fetch(`${origin}/api/integrations/exlr8/place-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Forwarded so the integration route can authenticate this internal call.
              cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({ orderId, userId, items: integrationItems }),
          }).catch(() => {}) // fire-and-forget — order already returned to client
        } else {
          fetch(`${origin}/api/integrations/exlr8/queue-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({ orderId, userId, items: integrationItems }),
          }).catch(() => {}) // fire-and-forget — order already returned to client
        }
      }
    } catch {
      // integration routing failure — non-critical
    }

    return NextResponse.json({
      success: true,
      orderId: orderId,
      order: normalizeId(orderForResponse),
      // Returned exactly once. The client stores it so a guest can reopen the order.
      ...(guestAccessToken ? { guestAccessToken } : {}),
    })
  } catch (error) {
    console.error("[Orders POST]", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
