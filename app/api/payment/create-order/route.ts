import { NextResponse } from "next/server"
import { createRazorpayOrder, getRazorpayKeyId, RazorpayOrderError } from "@/lib/razorpay"
import { getSession } from "@/lib/auth"
import { CheckoutQuoteSchema, quoteCheckout, createCheckoutIntent } from "@/lib/checkout-payment"
import { handleApiError } from "@/lib/api-error"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import type { NextRequest } from "next/server"
import { paymentEnabled, PaymentConfigurationError } from "@/lib/payment-config"
import { z } from "zod"
import { validateCheckoutCustomer } from "@/lib/checkout-customer"
import { idempotentCheckout } from "@/lib/checkout-idempotency"

const PaymentCheckoutSchema = CheckoutQuoteSchema.extend({ customer: z.record(z.unknown()), expectedAmount: z.number().int().positive() })

export async function POST(request: NextRequest) {
  try {
  const session = await getSession()
  return await idempotentCheckout(request, session?.user.id || null, "razorpay", () => createPayment(request))
  } catch (error) { return handleApiError(error, "Payment setup could not be confirmed. Keep your checkout and contact support before paying again.") }
}

async function createPayment(request: NextRequest) {
  let stage = "validation"
  try {
    if (!paymentEnabled("razorpay")) return NextResponse.json({ error: "Razorpay is disabled" }, { status: 503, headers: { "Checkout-Retry-Safe": "true" } })
    const limit = await checkRateLimit(request, RATE_LIMITS.ORDERS)
    if (!limit.success) return NextResponse.json({ error: RATE_LIMITS.ORDERS.message }, { status: 429 })
    const parsed = PaymentCheckoutSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const session = await getSession()
    const userId = session?.user.id || null
    const customer = await validateCheckoutCustomer(parsed.data.customer, parsed.data.fulfilment?.method, !userId)
    if (!customer.ok) return NextResponse.json({ error: customer.error }, { status: 400 })
    stage = "pricing"
    const quote = await quoteCheckout(parsed.data.items, { ...parsed.data, userId })
    if (!quote.ok) return NextResponse.json({ error: quote.error }, { status: 400 })
    if (Math.round(quote.amount * 100) !== parsed.data.expectedAmount) {
      return NextResponse.json({ error: "Your checkout total changed. Review the updated total before paying." }, { status: 409, headers: { "Checkout-Retry-Safe": "true" } })
    }
    if (quote.amount <= 0 || quote.amount > 5000000) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 })
    }
    stage = "gateway"
    const order = await createRazorpayOrder(Math.round(quote.amount * 100))
    stage = "checkout-intent"
    const checkoutToken = await createCheckoutIntent(order.id, userId, quote)
    return NextResponse.json({
      orderId: order.id, amount: order.amount, currency: order.currency,
      keyId: getRazorpayKeyId(), checkoutToken,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof RazorpayOrderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof PaymentConfigurationError) {
      console.error("[payment/create-order] Configuration error:", error.message)
      return NextResponse.json({ error: "Online payment is not configured correctly. Please contact support.", code: "PAYMENT_CONFIGURATION_ERROR" }, { status: 503, headers: { "Checkout-Retry-Safe": "true" } })
    }
    console.error("[payment/create-order] Failed at stage:", stage)
    return handleApiError(error, stage === "checkout-intent"
      ? "Could not save your payment checkout. Payment has not been taken. Please try again shortly."
      : "Could not prepare your payment checkout. Please try again shortly.")
  }
}
