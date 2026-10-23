import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { CheckoutQuoteSchema, createCheckoutIntent, quoteCheckout } from "@/lib/checkout-payment"
import { generateOrderId } from "@/lib/order-id"
import { storePaymentEnabled } from "@/lib/payment-config"
import { getStorePaymentWhatsAppSettings, loadPaymentStore, notifyStoreOfPaymentRequest, STORE_PAYMENT_REQUEST_TTL_MS } from "@/lib/store-payment"
import { itemCodesFor, storesHoldingStock } from "@/lib/store-stock"

export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "private, no-store" }

const StorePaymentRequestSchema = CheckoutQuoteSchema.extend({
  storeId: z.string().min(1).max(100),
  customer: z.object({
    name: z.string().trim().min(1, "Enter your name").max(120),
    email: z.string().trim().email("Enter a valid email").max(255),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number so the store can call you"),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    zipCode: z.string().trim().max(10).optional(),
  }),
})

export async function POST(request: NextRequest) {
  try {
    if (!storePaymentEnabled()) {
      return NextResponse.json({ error: "Pay at store is not available" }, { status: 403, headers })
    }
    // Every request messages a real store, so it is budgeted for signed-in shoppers too.
    const limit = await checkRateLimit(request, RATE_LIMITS.ORDERS)
    if (!limit.success) {
      return NextResponse.json({ error: RATE_LIMITS.ORDERS.message }, {
        status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfter ?? 60) },
      })
    }

    const parsed = StorePaymentRequestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400, headers })
    }
    const { items, couponCode, redeemPoints, fulfilment, storeId, customer } = parsed.data
    if (fulfilment?.method === "pickup" && fulfilment.storeId !== storeId) {
      return NextResponse.json({ error: "Pay at the store you are collecting from" }, { status: 400, headers })
    }

    const store = await loadPaymentStore(storeId)
    if (!store) return NextResponse.json({ error: "Selected store is unavailable" }, { status: 404, headers })
    if (!store.phone && !store.email) {
      return NextResponse.json({ error: "This store cannot take pay-at-store orders yet. Please choose another store." }, { status: 409, headers })
    }

    const userId = (await getSession())?.user?.id ?? null
    const quote = await quoteCheckout(items, { couponCode, userId, fulfilment, redeemPoints })
    if (!quote.ok) return NextResponse.json({ error: quote.error }, { status: 400, headers })
    const hardware = quote.pricing.items.filter(item => item.type !== "software")
    if (hardware.length) {
      const codes = await itemCodesFor(hardware.map(item => item.id))
      const holding = await storesHoldingStock(hardware.map(item => ({ sku: codes.get(item.id) ?? null, quantity: item.quantity })))
      if (!holding.has(store.id)) {
        return NextResponse.json({ error: "This store does not have every item in stock. Please choose another store or pay online." }, { status: 409, headers })
      }
    }

    const orderId = await generateOrderId()
    const requestToken = await createCheckoutIntent(orderId, userId, quote, "store-payment", {
      ttlMs: STORE_PAYMENT_REQUEST_TTL_MS,
      store: { id: store.id, name: store.name, phone: store.phone, email: store.email },
    })

    const address = [customer.address, customer.city, customer.state, customer.zipCode].filter(Boolean).join(", ")
    const delivery = fulfilment?.method === "pickup"
      ? `Store pickup at ${store.name}${address ? ` (customer address: ${address})` : ""}`
      : `Home delivery: ${address || "address not given"}`
    const offers: string[] = []
    const rupees = (value: number) => `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    if (quote.pricing.coupon) {
      offers.push(`Coupon ${quote.pricing.coupon.code}${quote.pricing.coupon.name ? ` (${quote.pricing.coupon.name})` : ""}: -${rupees(quote.pricing.coupon.discount)}`)
    }
    const rewardDiscount = Math.round((quote.pricing.total - quote.amount) * 100) / 100
    if (rewardDiscount > 0) offers.push(`Reward points: -${rupees(rewardDiscount)}`)
    const settings = await getStorePaymentWhatsAppSettings()
    const notified = await notifyStoreOfPaymentRequest(store, {
      orderId,
      customer: { name: customer.name, phone: customer.phone, email: customer.email },
      delivery,
      items: quote.pricing.items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
      offers,
      total: quote.amount,
    }, { notifyStoreManager: settings.notifyStoreManager, platformManagers: settings.platformManagers })
    if (!notified.whatsapp && !notified.email && !notified.managers) {
      console.error("[Store payment] Store could not be notified", { orderId, storeId: store.id })
    }

    return NextResponse.json({
      success: true,
      requestId: orderId,
      requestToken,
      store: { id: store.id, name: store.name, phone: store.phone },
      notified,
    }, { headers })
  } catch (error) {
    console.error("[Store payment request]", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Could not send your order to the store. Please try again." }, { status: 500, headers })
  }
}
