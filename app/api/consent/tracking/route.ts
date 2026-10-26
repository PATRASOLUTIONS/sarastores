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
import { z } from "zod"
import { getSession, requireUser } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"
import { recordConsent, clientIpFrom, CONSENT_PURPOSES, type ConsentDecision } from "@/lib/consent"
import { lookupConsent, rememberConsent } from "@/lib/consent-memory"
import { PRIVACY_NOTICE_VERSION } from "@/lib/dpdp-config"

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
    // An inherited (network) default is not the person's own decision, so it
    // must not be remembered as one.
    if (body.inherited !== true && (!noticeVersion || noticeVersion === PRIVACY_NOTICE_VERSION)) {
      await rememberConsent({
        userId: session?.user?.id ?? null,
        ip: clientIpFrom(request),
        choice: { analytics: Boolean(body.analytics), advertising: Boolean(body.advertising), personalisation: Boolean(body.personalisation) },
      }).catch(error => console.error("[consent] Banner decision could not be remembered", error))
    }

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

const noStore = { "Cache-Control": "private, no-store" }

/** Was a banner decision already made by this account, or on this network? */
export const GET = withRateLimit(async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const result = await lookupConsent({ userId: session?.user?.id ?? null, ip: clientIpFrom(request) })
    return NextResponse.json(result, { headers: noStore })
  } catch (error) {
    return handleApiError(error, "Failed to read tracking consent")
  }
}, { windowMs: 60 * 1000, maxRequests: 120, message: "Too many consent lookups." })

const RememberSchema = z.object({
  analytics: z.boolean(),
  advertising: z.boolean(),
  personalisation: z.boolean(),
  version: z.string().max(50),
  decidedAt: z.string().datetime(),
}).passthrough()

/**
 * Links the browser's existing decision to the signed-in account, so the same
 * person is not asked again on another device. The ledger already holds the
 * decision itself; this only updates the lookup memory.
 */
export async function PUT(request: NextRequest) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const parsed = RememberSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid consent" }, { status: 400, headers: noStore })
    if (parsed.data.version !== PRIVACY_NOTICE_VERSION) {
      return NextResponse.json({ error: "Consent was given against an older notice" }, { status: 409, headers: noStore })
    }
    await rememberConsent({
      userId: guard.user.id,
      ip: clientIpFrom(request),
      choice: { analytics: parsed.data.analytics, advertising: parsed.data.advertising, personalisation: parsed.data.personalisation },
      decidedAt: new Date(parsed.data.decidedAt),
    })
    return NextResponse.json({ success: true }, { headers: noStore })
  } catch (error) {
    return handleApiError(error, "Failed to remember tracking consent")
  }
}
