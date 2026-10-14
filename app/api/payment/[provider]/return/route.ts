import { NextResponse } from "next/server"
import { callbackFields, findHostedCallbackIntent, hostedProvider } from "@/lib/payment-callbacks"
import { reconcileHostedCheckout } from "@/lib/hosted-checkout"
import { paymentSiteOrigin } from "@/lib/payment-config"
import { handleApiError } from "@/lib/api-error"

export const dynamic = "force-dynamic"

async function handleReturn(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const provider = hostedProvider((await context.params).provider)
    if (!provider) return NextResponse.json({ error: "Unknown payment provider" }, { status: 404 })
    let fields: Record<string, string>
    try {
      fields = await callbackFields(request)
    } catch {
      return NextResponse.json({ error: "Invalid payment callback" }, { status: 400 })
    }
    const intent = await findHostedCallbackIntent(provider, fields)
    if (!intent) return NextResponse.json({ error: "Payment callback verification failed" }, { status: 400 })
    // Even a valid signature cannot substitute for a captured-amount lookup.
    try {
      await reconcileHostedCheckout(intent)
    } catch (error) {
      console.error("[Payment return] Status confirmation requires retry:", error instanceof Error ? error.message : "Unknown error")
    }
    return NextResponse.redirect(`${paymentSiteOrigin()}/checkout?paymentReturn=${encodeURIComponent(intent._id)}`, {
      status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    })
  } catch (error) {
    return handleApiError(error, "Payment return could not be processed")
  }
}

export const GET = handleReturn
export const POST = handleReturn
