import { NextResponse } from "next/server"
import { getRazorpayClient, getRazorpayKeyId } from "@/lib/razorpay"
import { getSession } from "@/lib/auth"
import { CheckoutQuoteSchema, quoteCheckout, createCheckoutIntent } from "@/lib/checkout-payment"
import { handleApiError } from "@/lib/api-error"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import type { NextRequest } from "next/server"
import { paymentEnabled } from "@/lib/payment-config"

export async function POST(request: NextRequest) {
  try {
    if (!paymentEnabled("razorpay")) return NextResponse.json({ error: "Razorpay is disabled" }, { status: 503 })
    const limit = await checkRateLimit(request, RATE_LIMITS.ORDERS)
    if (!limit.success) return NextResponse.json({ error: RATE_LIMITS.ORDERS.message }, { status: 429 })
    const parsed = CheckoutQuoteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const session = await getSession()
    const userId = session?.user.id || null
    const quote = await quoteCheckout(parsed.data.items, { ...parsed.data, userId })
    if (!quote.ok) return NextResponse.json({ error: quote.error }, { status: 400 })
    if (quote.amount <= 0 || quote.amount > 5000000) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 })
    }
    const order = await getRazorpayClient().orders.create({
      amount: Math.round(quote.amount * 100), currency: "INR", receipt: `receipt_${Date.now()}`,
    })
    const checkoutToken = await createCheckoutIntent(order.id, userId, quote)
    return NextResponse.json({
      orderId: order.id, amount: order.amount, currency: order.currency,
      keyId: getRazorpayKeyId(), checkoutToken,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    return handleApiError(error, "Failed to create payment order")
  }
}
