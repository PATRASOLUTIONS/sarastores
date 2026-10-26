import { NextResponse } from "next/server"
import { getCurrentUserId } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { MAX_CART_PRODUCTS } from "@/lib/cart-limits"
import { quoteCoupon } from "@/lib/order-pricing"
import { withRateLimit } from "@/lib/rate-limit"
import { z } from "zod"
import { CheckoutQuoteSchema } from "@/lib/checkout-payment"

const ApplyCouponSchema = z.object({
  code: z.string().trim().min(1).max(50),
  cart: CheckoutQuoteSchema.shape.items.max(MAX_CART_PRODUCTS),
  fulfilment: CheckoutQuoteSchema.shape.fulfilment,
})

// Guests may preview unrestricted coupons; per-customer caps require a session.
export const POST = withRateLimit(async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 })
    }
    const parsed = ApplyCouponSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })
    }
    const userId = await getCurrentUserId()
    const result = await quoteCoupon(parsed.data.cart, parsed.data.code, userId, undefined,
      parsed.data.fulfilment?.method === "pickup" ? "store" : "overall")
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, ...result.coupon, details: result.details })
  } catch (error) {
    return handleApiError(error, "Coupon validation failed")
  }
}, { windowMs: 60 * 1000, maxRequests: 20, message: "Too many coupon attempts, please try again shortly." })
