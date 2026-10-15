import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import type { CheckoutIntent } from "@/lib/checkout-payment"
import { callbackFields, findHostedCallbackIntent, hostedProvider } from "@/lib/payment-callbacks"
import { reconcileHostedCheckout } from "@/lib/hosted-checkout"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/api-error"

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const provider = hostedProvider((await context.params).provider)
    if (!provider) return NextResponse.json({ error: "Unknown payment provider" }, { status: 404 })
    const limit = await checkRateLimit(request, RATE_LIMITS.API)
    if (!limit.success) return NextResponse.json({ error: "Too many payment notifications" }, { status: 429 })
    let intent: CheckoutIntent | null
    if (provider === "paytm") {
      let fields: Record<string, string>
      try {
        fields = await callbackFields(request)
      } catch {
        return NextResponse.json({ error: "Invalid payment notification" }, { status: 400 })
      }
      intent = await findHostedCallbackIntent(provider, fields)
    } else {
      const text = await request.text()
      if (Buffer.byteLength(text) > 65536) return NextResponse.json({ error: "Payment notification is too large" }, { status: 413 })
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        return NextResponse.json({ error: "Invalid payment notification" }, { status: 400 })
      }
      const payload = z.object({ data: z.object({ order_id: z.string().min(1).max(100) }) }).safeParse(json)
      if (!payload.success) return NextResponse.json({ error: "Invalid payment notification" }, { status: 400 })
      // Pine's documented webhook has no signing scheme. Treat it ONLY as a
      // hint: server-authenticated Get Order supplies every trusted field.
      intent = await (await getCollection<CheckoutIntent>("checkout_intents")).findOne({
        _id: payload.data.data.order_id, method: "pinelabs",
      })
    }
    if (!intent) return NextResponse.json({ error: "Payment checkout not found or signature invalid" }, { status: 400 })
    const status = await reconcileHostedCheckout(intent)
    return NextResponse.json({ received: true, status }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleApiError(error, "Payment notification could not be processed; retry required")
  }
}
