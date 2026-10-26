import { type NextRequest, NextResponse, after } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { getSession } from "@/lib/auth"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { createGuestAccessToken, hashGuestAccessToken } from "@/lib/guest-order"
import { linkGuestOrdersToAccount } from "@/lib/guest-order-linking"
import { redeemPoints, quoteRedemption, reverseOrderPoints } from "@/lib/loyalty"
import { generateOrderId } from "@/lib/order-id"
import { priceOrder, consumeOrderCoupon } from "@/lib/order-pricing"
import { storesHoldingStock } from "@/lib/store-stock"
import { CartQuantitySchema } from "@/lib/validation"
import { verifyRazorpayPayment } from "@/lib/razorpay"
import { z } from "zod"
import { checkoutFingerprint, getCheckoutIntent, hashCheckoutToken, persistCheckoutOrder, CheckoutConflictError, type CheckoutIntent } from "@/lib/checkout-payment"
import { fulfillSoftwareOrder } from "@/lib/software-fulfillment"
import { queueExternalOrder, fulfillExternalOrder } from "@/lib/external-fulfillment"
import { initiateHostedCheckout, notifyHostedGuestOrder } from "@/lib/hosted-checkout"
import { cashOnDeliveryEnabled, inStorePurchaseEnabled, storePaymentEnabled, PaymentConfigurationError } from "@/lib/payment-config"
import { StorePaymentTransactionSchema } from "@/types/store-payment"
import { PaymentProviderError } from "@/lib/hosted-payment-providers"
import { getOrderAdminScope } from "@/lib/order-access"
import { notifyAdminOrder } from "@/lib/order-notifications"
import { GuestCheckoutCustomerSchema, CheckoutContactSchema } from "@/lib/validation"
import { validateCheckoutCustomer } from "@/lib/checkout-customer"
import { ACTIVE_RETAIL_STORE_FILTER } from "@/lib/store-locations"
import { ObjectId } from "mongodb"
import { deriveCity, derivePincode } from "@/lib/store-address"
import { idempotentCheckout } from "@/lib/checkout-idempotency"
import { handleApiError } from "@/lib/api-error"
import { DeclinedGiftPromotionsSchema, SelectedGiftPromotionsSchema, ExpectedGiftsSchema, giftSelectionSignature } from "@/lib/gift-validation"
import { quoteGiftPromotions, consumeGiftPromotions } from "@/lib/gift-promotions"

export const dynamic = "force-dynamic"

interface OrderListDocument {
  id: string
  userId?: string
  customerId?: string
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
  storePayment?: unknown
  paymentVerification?: { verified?: boolean }
  licenseFulfillment?: { status?: string }
  licenseKeys?: string[]
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
    const orderScope = await getOrderAdminScope(session)
    const isStaff = !isAdminRole && orderScope.kind !== "none"

    await linkGuestOrdersToAccount(session.user)

    const employeeId = isAdminRole ? request.nextUrl.searchParams.get("employeeId") : null
    const limit = request.nextUrl.searchParams.get("limit")
    const couponCode = isAdminRole ? request.nextUrl.searchParams.get("couponCode") : null
    const couponUsageCount = isAdminRole ? request.nextUrl.searchParams.get("couponUsageCount") : null
    const userId = isAdminRole || isStaff ? request.nextUrl.searchParams.get("userId") : session.user.id

    if (couponUsageCount) {
      const codes = couponUsageCount.split(",").map((c) => c.trim().toUpperCase())
      const collection = await getCollection("orders")
      const counts: Record<string, number> = Object.fromEntries(codes.map((code) => [code, 0]))
      const grouped = await collection.aggregate<{ _id: string; count: number }>([
        { $match: { "coupon.code": { $in: codes } } },
        { $group: { _id: "$coupon.code", count: { $sum: 1 } } },
      ]).toArray()
      for (const row of grouped) counts[row._id] = row.count
      return NextResponse.json({ counts })
    }

    const collection = await getCollection("orders")

    let query: Record<string, unknown> = {}
    if (userId) query = { $or: [{ userId }, { userId: { $in: [null, ""] }, customerId: userId }] }
    if (isStaff) {
      query = { ...query, ...orderScope.filter }
    }
    if (employeeId) {
      query = {
        $and: [
          query,
          { $or: [
            { "paymentDetails.employeeId": employeeId },
            { "paymentDetails.verifiedEmail": employeeId },
            { employeeId }
          ] },
        ]
      }
    }
    if (couponCode) query = { $and: [query, { $or: [{ "coupon.code": couponCode.toUpperCase() }, { "giftPromotions.code": couponCode.toUpperCase() }] }] }

    let ordersQuery = collection.find(query).sort({ createdAt: -1 })

    if (limit) {
      const limitNum = Number.parseInt(limit, 10)
      if (!isNaN(limitNum) && limitNum > 0) {
        ordersQuery = ordersQuery.limit(limitNum)
      }
    }

    const orders = await ordersQuery.toArray()

    const normalizedOrders = normalizeId(orders).map((order: OrderListDocument) => ({
      userId: order.userId || order.customerId || null,
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
      storePayment: order.storePayment || null,
      paymentVerification: { verified: order.paymentVerification?.verified === true },
      licenseFulfillment: order.licenseFulfillment?.status ? { status: order.licenseFulfillment.status } : null,
      licenseKeys: Array.isArray(order.licenseKeys) ? order.licenseKeys : [],
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
          storePayment: null,
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
          licenseFulfillment: null,
          licenseKeys: [],
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
  const body = await request.clone().json().catch(() => null)
  const hosted = body?.paymentMethod === "pinelabs" || body?.paymentMethod === "paytm"
  return await idempotentCheckout(request, session?.user.id || null, "order", () => createOrder(request), hosted)
  } catch (error) { return handleApiError(error, "Your order could not be confirmed. Keep your checkout and contact support before paying again.") }
}

async function createOrder(request: NextRequest) {
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
        quantity: CartQuantitySchema,
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
        variantId: z.string().nullish(), ram: z.string().nullish(), storage: z.string().nullish(),
      })).min(1, 'Order must contain at least one item'),
      customer: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        name: z.string().optional(),
        email: z.string(),
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
      paymentMethod: z.enum(["cash", "cod", "cash-on-delivery", "online", "razorpay", "pinelabs", "paytm", "instore", "store-payment"]).optional(),
      paymentDetails: z.record(z.unknown()).optional(),
      expectedAmount: z.number().int().positive().optional(),
      fulfilment: z.object({
        method: z.enum(["delivery", "pickup"]),
        storeId: z.string().optional(),
        storeName: z.string().optional(),
        storeAddress: z.string().optional(),
        storePhone: z.string().optional(),
      }).optional(),
      coupon: z.object({ code: z.string() }).nullish(),
      redeemPoints: z.number().int().min(0).max(1_000_000).optional(),
      declinedGiftPromotions: DeclinedGiftPromotionsSchema,
      selectedGiftPromotions: SelectedGiftPromotionsSchema,
      expectedGifts: ExpectedGiftsSchema.optional(),
    })

    const parsed = orderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { items, customer, paymentMethod, paymentDetails } = parsed.data
    const nameParts = (customer.name || "").trim().split(/\s+/)
    const contact = CheckoutContactSchema.safeParse({ ...customer,
      firstName: customer.firstName || nameParts[0],
      lastName: customer.lastName || nameParts.slice(1).join(" "),
    })
    if (!contact.success) return NextResponse.json({ error: contact.error.issues[0].message,
      fieldErrors: contact.error.flatten().fieldErrors }, { status: 400 })
    Object.assign(customer, contact.data, { name: `${contact.data.firstName} ${contact.data.lastName}` })
    if (isGuest) {
      const details = GuestCheckoutCustomerSchema.safeParse({ ...customer,
        firstName: customer.firstName || customer.name,
      })
      if (!details.success) return NextResponse.json({ error: details.error.issues[0].message }, { status: 400 })
      Object.assign(customer, details.data)
    }
    const method = paymentMethod || "cash"
    const userId = session?.user?.id ?? null
    // The same checkout capability may recover a committed order after the
    // response was lost. It must never create a second order or consume stock twice.
    const recoveryId = method === "store-payment" ? paymentDetails?.requestId : paymentDetails?.orderId
    const recoveryToken = method === "store-payment" ? paymentDetails?.requestToken : paymentDetails?.checkoutToken
    if (["online", "razorpay", "store-payment"].includes(method) && typeof recoveryId === "string" && typeof recoveryToken === "string") {
      const consumed = await getCheckoutIntent(recoveryId, recoveryToken, userId, true)
      const paymentMatches = consumed?.method === "razorpay" && consumed.paymentId === (paymentDetails?.paymentId || paymentDetails?.transactionId)
      if (consumed?.status === "consumed" && consumed.orderId && (paymentMatches || consumed.method === "store-payment")) {
        const existing = await (await getCollection("orders")).findOne({ orderId: consumed.orderId, userId })
        const storeMatches = consumed.method === "store-payment" && existing?.storePayment?.platform === paymentDetails?.platform
          && existing?.storePayment?.transactionId === paymentDetails?.transactionId
        if (existing && (paymentMatches || storeMatches)) {
          const order = normalizeId(existing)
          delete order.guestAccessTokenHash
          const guestToken = hashCheckoutToken(`guest-order:${consumed._id}:${recoveryToken}`)
          return NextResponse.json({ success: true, orderId: existing.orderId, order,
            ...(isGuest && hashGuestAccessToken(guestToken) === existing.guestAccessTokenHash ? { guestAccessToken: guestToken } : {}),
          }, { headers: { "Cache-Control": "private, no-store" } })
        }
      }
    }
    if (parsed.data.fulfilment && !["online", "razorpay", "pinelabs", "paytm", "store-payment"].includes(method)) {
      return NextResponse.json({ error: "Choose online payment, or Pay at Store for pickup." }, { status: 400 })
    }
    const deliveryValidation = await validateCheckoutCustomer(customer, parsed.data.fulfilment?.method, isGuest)
    if (!deliveryValidation.ok) return NextResponse.json({ error: deliveryValidation.error }, { status: 400 })
    if (["cash", "cod", "cash-on-delivery"].includes(method) && !cashOnDeliveryEnabled()) {
      return NextResponse.json({ error: "Cash on Delivery is currently unavailable. Please choose another payment method." }, { status: 403 })
    }
    if (!isGuest && (paymentMethod === "pinelabs" || paymentMethod === "paytm")) {
      const limit = await checkRateLimit(request, RATE_LIMITS.ORDERS)
      if (!limit.success) return NextResponse.json({ error: RATE_LIMITS.ORDERS.message }, { status: 429 })
    }

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
      return NextResponse.json({ error: pricing.error, ...(pricing.code ? { code: pricing.code } : {}) }, { status: 400 })
    }
    pricing.gifts = await quoteGiftPromotions(pricing.items, userId, parsed.data.declinedGiftPromotions, undefined, parsed.data.selectedGiftPromotions)
    if (parsed.data.expectedGifts && giftSelectionSignature(parsed.data.expectedGifts) !== giftSelectionSignature(pricing.gifts)) return NextResponse.json({
      error: "Free gifts changed. Review the updated gift selection before paying.",
    }, { status: 409, headers: method === "pinelabs" || method === "paytm" ? { "Checkout-Retry-Safe": "true" } : {} })

    const { items: validatedItems, subtotal, tax, shipping, total, coupon } = pricing
    const pickupLocation = parsed.data.fulfilment?.method === "pickup"
      ? await (await getCollection("store_locations")).findOne({ _id: new ObjectId(parsed.data.fulfilment.storeId!), ...ACTIVE_RETAIL_STORE_FILTER })
      : null
    if (parsed.data.fulfilment?.method === "pickup" && !pickupLocation) return NextResponse.json({ error: "The pickup store is unavailable." }, { status: 409,
      headers: method === "pinelabs" || method === "paytm" ? { "Checkout-Retry-Safe": "true" } : {} })
    const pickupAddress = pickupLocation ? String(pickupLocation.locationDescription || "") : ""
    const trustedFulfilment = pickupLocation ? {
      method: "pickup", storeId: pickupLocation._id.toString(), storeCode: String(pickupLocation.storeCode || ""),
      storeName: String(pickupLocation.shopName || ""), storeAddress: pickupAddress, storePhone: String(pickupLocation.mobileNo || ""),
    } : { method: "delivery", ...(parsed.data.fulfilment?.storeId ? { storeId: parsed.data.fulfilment.storeId } : {}) }

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
    if (parsed.data.expectedAmount !== undefined && Math.round(payableTotal * 100) !== parsed.data.expectedAmount) {
      return NextResponse.json({ error: "Your checkout total changed. Review it before paying." }, { status: 409,
        headers: method === "pinelabs" || method === "paytm" ? { "Checkout-Retry-Safe": "true" } : {} })
    }
    // An order only reaches a paid state once the payment is confirmed server-side.
    const hosted = method === "pinelabs" || method === "paytm"
    let status = "pending"
    let paymentVerification: Record<string, unknown> = { verified: false, method }
    let checkoutIntent: CheckoutIntent | null = null
    let storePayment: Record<string, unknown> | null = null
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
      if (!inStorePurchaseEnabled()) {
        return NextResponse.json({ error: "In-store purchase is not available" }, { status: 403 })
      }
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
    } else if (method === "store-payment") {
      if (parsed.data.fulfilment?.method !== "pickup") {
        return NextResponse.json({ error: "Pay at Store is available only for store pickup. Choose online payment for home delivery." }, { status: 400 })
      }
      if (!storePaymentEnabled()) {
        return NextResponse.json({ error: "Pay at store is not available" }, { status: 403 })
      }
      const requestId = paymentDetails?.requestId
      const requestToken = paymentDetails?.requestToken
      if (typeof requestId !== "string" || typeof requestToken !== "string") {
        return NextResponse.json({ error: "Pay at store request is required" }, { status: 400 })
      }
      const transaction = StorePaymentTransactionSchema.safeParse({
        platform: paymentDetails?.platform, transactionId: paymentDetails?.transactionId,
      })
      if (!transaction.success) {
        return NextResponse.json({ error: transaction.error.issues[0]?.message || "Invalid transaction details" }, { status: 400 })
      }
      checkoutIntent = await getCheckoutIntent(requestId, requestToken, userId)
      if (!checkoutIntent || checkoutIntent.method !== "store-payment" || checkoutIntent.status !== "created" || !checkoutIntent.store ||
        checkoutIntent.store.id !== parsed.data.fulfilment.storeId ||
        checkoutIntent.fingerprint !== fingerprint || checkoutIntent.amount !== Math.round(payableTotal * 100)) {
        return NextResponse.json({ error: "Your pay at store request has changed or expired. Please place the order again." }, { status: 409 })
      }
      const reused = await (await getCollection("orders")).findOne({
        "storePayment.platform": transaction.data.platform,
        "storePayment.transactionId": transaction.data.transactionId,
      }, { projection: { _id: 1 } })
      if (reused) {
        return NextResponse.json({ error: "This transaction ID has already been used for another order" }, { status: 409 })
      }
      storePayment = {
        status: "confirmation_pending",
        storeId: checkoutIntent.store.id,
        storeName: checkoutIntent.store.name,
        storePhone: checkoutIntent.store.phone,
        storeEmail: checkoutIntent.store.email,
        platform: transaction.data.platform,
        transactionId: transaction.data.transactionId,
        submittedAt: new Date(),
      }
    }

    // The store was already sent this reference, so the order keeps it.
    const orderId = checkoutIntent?.method === "store-payment" ? checkoutIntent._id : await generateOrderId()

    // Guests need a high-entropy capability; sequential order ids never grant access.
    // Paid checkout capabilities reproduce the same guest link during recovery.
    const checkoutCapability = checkoutIntent?.method === "razorpay" ? paymentDetails?.checkoutToken : checkoutIntent?.method === "store-payment" ? paymentDetails?.requestToken : null
    const guestAccessToken = isGuest ? checkoutIntent && typeof checkoutCapability === "string"
      ? hashCheckoutToken(`guest-order:${checkoutIntent._id}:${checkoutCapability}`) : createGuestAccessToken() : null

    const newOrder = {
      orderId,
      userId,
      isGuest,
      ...(guestAccessToken
        ? { guestAccessTokenHash: hashGuestAccessToken(guestAccessToken) }
        : {}),
      items: validatedItems,
      giftPromotions: pricing.gifts,
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
      shippingAddress: pickupLocation ? {
        name: customer.name || "", street: pickupAddress,
        city: String(pickupLocation.city || deriveCity(pickupAddress)), state: String(pickupLocation.state || ""),
        zip: String(pickupLocation.pincode || derivePincode(pickupAddress)), country: "India",
      } : {
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
        ...(storePayment ? { platform: storePayment.platform, transactionId: storePayment.transactionId, storeId: storePayment.storeId, storeName: storePayment.storeName } : {}),
      },
      paymentVerification,
      ...(storePayment ? { storePayment } : {}),
      // Store pickup is recorded here; reserving the unit against store stock
      // waits on the SAP inventory feed (see docs/brd/PENDING-EXTERNAL-INTEGRATIONS.md).
      fulfilment: trustedFulfilment,
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
          description: storePayment
            ? "Your order has been placed. We are confirming your store payment."
            : "Your order has been placed successfully",
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
    if (pricing.gifts.length) newOrder.notes += "\nFREE GIFTS:\n" + pricing.gifts.map(gift => `${gift.name} | SKU ${gift.sku} | Qty ${gift.quantity} | FREE (Rs. 0) | ${gift.code}`).join("\n")

    const hostedCheckout = hosted
      ? await initiateHostedCheckout(method, orderId, userId, { amount: payableTotal, fingerprint }, newOrder.customer)
      : null
    if (hostedCheckout) {
      checkoutIntent = await getCheckoutIntent(hostedCheckout.orderId, hostedCheckout.checkoutToken, userId)
      if (!checkoutIntent) throw new Error("Hosted checkout intent could not be persisted")
      Object.assign(newOrder.paymentDetails, { orderId: hostedCheckout.orderId })
    }

    const insertedId = await persistCheckoutOrder(newOrder, checkoutIntent, async (transaction) => {
      const latest = await priceOrder(items, { userId, couponCode: parsed.data.coupon?.code,
        fulfilment: parsed.data.fulfilment, session: transaction })
      if (!latest.ok) throw new CheckoutConflictError(latest.error)
      latest.gifts = await quoteGiftPromotions(latest.items, userId, parsed.data.declinedGiftPromotions, transaction, parsed.data.selectedGiftPromotions)
      if (method === "store-payment" && checkoutIntent?.store) {
        const holding = await storesHoldingStock(latest.items.filter(item => item.type !== "software")
          .map(item => ({ sku: item.sku || null, quantity: item.quantity })), transaction)
        if (!holding.has(checkoutIntent.store.id)) {
          throw new CheckoutConflictError("Pay at store is unavailable for the requested quantities. Please choose home delivery and pay online.")
        }
      }
      if (latest.total !== pricing.total || latest.shipping !== pricing.shipping || latest.tax !== pricing.tax
        || latest.subtotal !== pricing.subtotal || latest.couponDiscount !== pricing.couponDiscount
        || checkoutFingerprint(latest, { fulfilment: parsed.data.fulfilment, redeemPoints: parsed.data.redeemPoints }, payableTotal)
        !== checkoutFingerprint(pricing, { fulfilment: parsed.data.fulfilment, redeemPoints: parsed.data.redeemPoints }, payableTotal)) {
        throw new CheckoutConflictError("Prices or checkout charges changed. Please review checkout before retrying.")
      }
      if (hosted) return
      try { await consumeGiftPromotions(pricing.gifts || [], orderId, userId, transaction) }
      catch (error) { throw new CheckoutConflictError(error instanceof Error ? error.message : "Free gift usage could not be recorded") }
      if (coupon) {
        const consumption = await consumeOrderCoupon(items, coupon, userId, transaction,
          parsed.data.fulfilment?.method === "pickup" ? "store" : "overall")
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

    if (hostedCheckout) {
      if (guestAccessToken) notifyHostedGuestOrder(orderId, newOrder.customer.email, guestAccessToken)
      return NextResponse.json({
        success: true, orderId, total: payableTotal, tax, shipping, checkout: hostedCheckout,
        ...(guestAccessToken ? { guestAccessToken } : {}),
      }, { headers: { "Cache-Control": "private, no-store" } })
    }

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

    await notifyAdminOrder(insertedId, "orders", status === "confirmed" ? "confirmed" : "created")

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
    if (error instanceof PaymentConfigurationError || error instanceof PaymentProviderError) {
      console.error("[Orders POST] Hosted payment initiation failed:", error.message)
      return NextResponse.json({ error: error instanceof PaymentConfigurationError
        ? "Selected payment gateway is not configured or is disabled"
        : "Payment gateway is unavailable. No payment has been confirmed." }, { status: 503,
          headers: error instanceof PaymentConfigurationError ? { "Checkout-Retry-Safe": "true" } : {} })
    }
    if (error instanceof CheckoutConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("[Orders POST]", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
