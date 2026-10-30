import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { CheckoutQuoteSchema, quoteCheckout } from "@/lib/checkout-payment"
import { handleApiError } from "@/lib/api-error"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

// Read-only validation supports both authenticated customers and guest carts.
// It creates no order, payment, reservation or external provider request.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const limit = await checkRateLimit(request, RATE_LIMITS.API)
    if (!limit.success) return NextResponse.json({ error: "Too many checkout validation requests. Please try again shortly." }, { status: 429 })
    const parsed = CheckoutQuoteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const options = { ...parsed.data, userId: session?.user.id || null }
    let quote = await quoteCheckout(parsed.data.items, options)
    let couponMessage: string | null = null
    if (!quote.ok && "code" in quote && quote.code === "COUPON_UNAVAILABLE" && parsed.data.couponCode) {
      couponMessage = quote.error
      quote = await quoteCheckout(parsed.data.items, { ...options, couponCode: null })
    }
    if (!quote.ok) return NextResponse.json({ error: quote.error }, { status: 400 })
    return NextResponse.json({ success: true, pricing: quote.pricing, amount: quote.amount, couponMessage }, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) { return handleApiError(error, "Checkout validation is temporarily unavailable.") }
}
