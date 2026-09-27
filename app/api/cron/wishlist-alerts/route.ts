import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { requireCron } from "@/lib/cron-auth"
import { runWishlistAlerts } from "@/lib/retention/wishlist-alerts"

export const dynamic = "force-dynamic"

/**
 * Back-in-stock and price-drop alerts for wishlisted products.
 *
 * The first ever run only records a baseline snapshot and sends nothing — there is
 * no previous state to compare against, and alerting on everything at once would be
 * indistinguishable from spam.
 */
export async function POST(request: NextRequest) {
  const guard = requireCron(request)
  if (!guard.ok) return guard.response

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1"
    const result = await runWishlistAlerts({ dryRun })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error, "Failed to run wishlist alerts")
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
