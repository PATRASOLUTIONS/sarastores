import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/api-error"
import { quoteSaraCare, SaraCareSelectionError } from "@/lib/sara-care"
import { SaraCareQuoteRequestSchema } from "@/lib/sara-care-types"

// Public price quote for guest carts; no account data or mutations.
export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit(request, { windowMs: 60000, maxRequests: 100 })
    if (!limit.success) return NextResponse.json({ error: "Too many quotes. Please retry shortly." }, { status: 429 })
    const parsed = SaraCareQuoteRequestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid Sara Care cart" }, { status: 400 })
    const parents = parsed.data.items.filter(item => item.type !== "service" && !item.saraCare)
    const quote = await quoteSaraCare(parents)
    return NextResponse.json(quote, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof SaraCareSelectionError) return NextResponse.json({ error: error.message }, { status: 400 })
    return handleApiError(error, "Sara Care prices could not be refreshed")
  }
}
