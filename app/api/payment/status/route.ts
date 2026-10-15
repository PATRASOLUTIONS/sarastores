import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { hashCheckoutToken, type CheckoutIntent } from "@/lib/checkout-payment"
import { reconcileHostedCheckout } from "@/lib/hosted-checkout"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/api-error"

const StatusSchema = z.object({
  orderId: z.string().min(1).max(100),
  checkoutToken: z.string().min(20).max(100),
})

export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit(request, RATE_LIMITS.API)
    if (!limit.success) return NextResponse.json({ error: "Too many payment status requests" }, { status: 429 })
    const parsed = StatusSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid checkout reference" }, { status: 400 })
    const session = await getSession()
    const intent = await (await getCollection<CheckoutIntent>("checkout_intents")).findOne({
      _id: parsed.data.orderId, tokenHash: hashCheckoutToken(parsed.data.checkoutToken),
    })
    if (!intent || !intent.orderId || (intent.userId !== null && intent.userId !== session?.user.id) ||
      (intent.method !== "pinelabs" && intent.method !== "paytm")) {
      return NextResponse.json({ error: "Checkout not found or access denied" }, { status: 404 })
    }
    const status = await reconcileHostedCheckout(intent)
    return NextResponse.json({ status, orderId: intent.orderId }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    return handleApiError(error, "Payment status could not be confirmed. Please retry before paying again.")
  }
}
