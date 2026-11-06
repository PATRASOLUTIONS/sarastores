import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"
import { getStorefrontPromotions } from "@/lib/storefront-promotions"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" }

/** Public, read-only quotes. Identity comes exclusively from the session. */
export const GET = withRateLimit(async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const productId = params.get("productId")
  if ([...params.keys()].some(key => key !== "productId") || params.getAll("productId").length > 1 ||
    (productId !== null && (!productId.trim() || productId.length > 200 || /[\x00-\x1f]/.test(productId)))) {
    return NextResponse.json({ error: "Supply only a valid productId." }, { status: 400, headers })
  }
  try {
    return NextResponse.json(await getStorefrontPromotions(productId, await getSession()), { headers })
  } catch (error) {
    const response = handleApiError(error)
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
    return response
  }
}, { windowMs: 60000, maxRequests: 30, message: "Please wait before checking offers again." })
