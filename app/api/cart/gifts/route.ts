import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { CheckoutQuoteSchema } from "@/lib/checkout-payment"
import { priceCatalogueCart } from "@/lib/order-pricing"
import { quoteGiftPromotions } from "@/lib/gift-promotions"
import { handleApiError } from "@/lib/api-error"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!(await checkRateLimit(request, RATE_LIMITS.API)).success) return NextResponse.json({ error: "Please wait before refreshing cart gifts" }, { status: 429 })
    const parsed = CheckoutQuoteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const cart = await priceCatalogueCart(parsed.data.items, undefined, parsed.data.fulfilment?.method === "pickup" ? "store" : "overall")
    if (!cart.ok) return NextResponse.json({ error: cart.error }, { status: 400 })
    const gifts = await quoteGiftPromotions(cart.items, session?.user.id || null)
    return NextResponse.json({ success: true, gifts }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return handleApiError(error, "Free gifts could not be checked. Please retry.") }
}
