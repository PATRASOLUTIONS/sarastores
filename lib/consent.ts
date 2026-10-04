/**
 * Consent ledger — DPDP Act 2023, Sections 6 and 7.
 *
 * Section 6(1) requires consent to be free, specific, informed, unconditional
 * and unambiguous, given by a clear affirmative action. Under Section 8(4) the
 * Data Fiduciary — not the Data Principal — carries the burden of proving that
 * valid consent was obtained. A boolean on a profile document cannot discharge
 * that burden: it records the current state but not who agreed to what, when,
 * or against which version of the notice.
 *
 * So `consent_records` is an append-only ledger. A withdrawal is a new row, not
 * an update, which means the history survives and a point-in-time question
 * ("what had this customer agreed to last March?") is answerable.
 *
 * `customer_profiles.consent` remains the fast read path for campaign
 * targeting. This ledger is the evidence behind it.
 */

import type { NextRequest } from "next/server"
import { getCollection, COLLECTIONS } from "@/lib/db-service"
import { PRIVACY_NOTICE_VERSION } from "@/lib/dpdp-config"

export const COLLECTION_CONSENT_RECORDS = COLLECTIONS.CONSENT_RECORDS

/**
 * Processing purposes, kept separate so consent is "specific" per Section 6(1).
 * Bundling marketing into account creation is exactly what the Act prohibits.
 */
export const CONSENT_PURPOSES = {
  /** Account creation, authentication, order fulfilment, statutory records. */
  ACCOUNT: "account_and_orders",
  MARKETING_EMAIL: "marketing_email",
  MARKETING_WHATSAPP: "marketing_whatsapp",
  MARKETING_SMS: "marketing_sms",
  /** Usage measurement — only ever optional. */
  ANALYTICS: "analytics",
  /** Behavioural advertising and retargeting pixels. */
  ADVERTISING: "advertising",
  /** Personalised recommendations derived from browsing and purchase history. */
  PERSONALISATION: "personalisation",
} as const

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[keyof typeof CONSENT_PURPOSES]

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  account_and_orders: "Creating your account and fulfilling your orders",
  marketing_email: "Marketing emails about offers and new arrivals",
  marketing_whatsapp: "Marketing messages on WhatsApp",
  marketing_sms: "Marketing SMS about time-sensitive offers",
  analytics: "Measuring how the website is used so we can improve it",
  advertising: "Showing you relevant ads on other websites",
  personalisation: "Personalised product recommendations",
}

/**
 * Purposes that are necessary to provide the service. These are the only ones
 * that may be required as a condition of having an account; everything else
 * must be genuinely optional or the consent is not "free".
 */
export const NECESSARY_PURPOSES: ConsentPurpose[] = [CONSENT_PURPOSES.ACCOUNT]

export const OPTIONAL_PURPOSES: ConsentPurpose[] = [
  CONSENT_PURPOSES.MARKETING_EMAIL,
  CONSENT_PURPOSES.MARKETING_WHATSAPP,
  CONSENT_PURPOSES.MARKETING_SMS,
  CONSENT_PURPOSES.ANALYTICS,
  CONSENT_PURPOSES.ADVERTISING,
  CONSENT_PURPOSES.PERSONALISATION,
]

/** Where the affirmative action happened, for the audit trail. */
export type ConsentSource =
  | "signup"
  | "preference_centre"
  | "cookie_banner"
  | "unsubscribe_link"
  | "checkout"
  | "account_deletion"
  | "admin_action"

export type ConsentRecord = {
  userId: string | null
  /** Set for pre-login consent (cookie banner) so it can be reconciled later. */
  anonymousId: string | null
  purpose: ConsentPurpose
  granted: boolean
  source: ConsentSource
  /** Which version of the privacy notice was on screen at the time. */
  noticeVersion: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

/**
 * Best-effort client IP. Behind Vercel the left-most `x-forwarded-for` entry is
 * the real client; everything after it is proxy hops.
 */
export function clientIpFrom(request: NextRequest | Request): string | null {
  const headers = request.headers
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip") || null
}

export function userAgentFrom(request: NextRequest | Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 500) || null
}

export type ConsentDecision = { purpose: ConsentPurpose; granted: boolean }

/**
 * Append consent decisions to the ledger. Never updates in place — a change of
 * mind is a new row, so the history remains intact.
 */
export async function recordConsent(params: {
  userId?: string | null
  anonymousId?: string | null
  decisions: ConsentDecision[]
  source: ConsentSource
  request?: NextRequest | Request
  noticeVersion?: string
}): Promise<number> {
  const { userId = null, anonymousId = null, decisions, source, request } = params
  if (!decisions.length) return 0

  const now = new Date()
  const rows: ConsentRecord[] = decisions.map(({ purpose, granted }) => ({
    userId: userId ? String(userId) : null,
    anonymousId: anonymousId ? String(anonymousId) : null,
    purpose,
    granted,
    source,
    noticeVersion: params.noticeVersion || PRIVACY_NOTICE_VERSION,
    ipAddress: request ? clientIpFrom(request) : null,
    userAgent: request ? userAgentFrom(request) : null,
    createdAt: now,
  }))

  try {
    const collection = await getCollection(COLLECTION_CONSENT_RECORDS)
    await collection.insertMany(rows)
    return rows.length
  } catch (error) {
    // Consent logging must never break the user's journey, but a silent failure
    // would destroy the audit trail, so it is logged loudly.
    console.error("[consent] failed to write consent records", error)
    return 0
  }
}

/** Full consent history for one person, newest first — feeds the data export. */
export async function getConsentHistory(userId: string): Promise<ConsentRecord[]> {
  if (!userId) return []
  const collection = await getCollection(COLLECTION_CONSENT_RECORDS)
  const rows = await collection
    .find({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .limit(500)
    .project({ _id: 0 })
    .toArray()
  return rows as unknown as ConsentRecord[]
}

/** Latest decision per purpose — the current effective consent state. */
export async function getCurrentConsent(userId: string): Promise<Record<string, boolean>> {
  const history = await getConsentHistory(userId)
  const current: Record<string, boolean> = {}
  // History is newest-first, so the first entry seen for a purpose wins.
  for (const row of history) {
    if (!(row.purpose in current)) current[row.purpose] = row.granted
  }
  return current
}

/**
 * Record a withdrawal of every optional purpose. Used by account deletion and
 * by "reject all" in the cookie banner.
 */
export async function withdrawAllOptional(params: {
  userId?: string | null
  anonymousId?: string | null
  source: ConsentSource
  request?: NextRequest | Request
}): Promise<number> {
  return recordConsent({
    ...params,
    decisions: OPTIONAL_PURPOSES.map((purpose) => ({ purpose, granted: false })),
  })
}
