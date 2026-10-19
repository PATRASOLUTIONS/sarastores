/**
 * POST /api/consent/tracking — mirrors a cookie-banner decision into the
 * consent ledger.
 *
 * The browser already has the decision in localStorage; this exists so the
 * Data Fiduciary can discharge the Section 8(4) burden of proving consent.
 * Deliberately open to unauthenticated callers, because the banner is shown
 * before sign-in — those rows carry an `anonymousId` instead of a `userId`.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"
import { recordConsent, CONSENT_PURPOSES, type ConsentDecision } from "@/lib/consent"

export const dynamic = "force-dynamic"

export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const anonymousId =
      typeof body.anonymousId === "string" ? body.anonymousId.slice(0, 100) : null
    const noticeVersion =
      typeof body.version === "string" ? body.version.slice(0, 50) : undefined

    const decisions: ConsentDecision[] = [
      { purpose: CONSENT_PURPOSES.ANALYTICS, granted: Boolean(body.analytics) },
      { purpose: CONSENT_PURPOSES.ADVERTISING, granted: Boolean(body.advertising) },
      { purpose: CONSENT_PURPOSES.PERSONALISATION, granted: Boolean(body.personalisation) },
    ]

    // Attach the account when there is one, so a signed-in person's banner
    // choice lands on their record rather than floating as anonymous.
    const session = await getSession()

    await recordConsent({
      userId: session?.user?.id ?? null,
      anonymousId,
      decisions,
      source: "cookie_banner",
      request,
      noticeVersion,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to record tracking consent")
  }
  /*
   * Failing to record a consent decision is a compliance problem, so this
   * budget is deliberately loose: it exists to bound abuse by orders of
   * magnitude, not to police legitimate traffic. A single office or carrier NAT
   * can put many first-time visitors behind one address — a back-to-back test
   * run exhausted a 60/minute budget on its own — while 120 still caps one
   * caller far below what it takes to inflate the ledger meaningfully.
   */
}, { windowMs: 60 * 1000, maxRequests: 120, message: "Too many consent updates." })
