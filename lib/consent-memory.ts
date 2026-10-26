/**
 * Server-side memory of cookie-banner decisions, so the banner is not asked
 * again on a new browser, device or cleared storage.
 *
 * Two keys are kept per decision: the signed-in account, and a salted hash of
 * the client IP (the raw address is never stored here). An account match
 * restores that person's own choice. An IP match only proves someone on the
 * same network decided, and one person's consent cannot stand in for
 * another's (DPDP s.6(1)), so it suppresses the banner with optional tracking
 * left off; the visitor can still opt in from "Cookie preferences".
 */

import { createHash } from "node:crypto"
import { getCollection } from "@/lib/db-service"
import { PRIVACY_NOTICE_VERSION } from "@/lib/dpdp-config"

export const CONSENT_MEMORY_COLLECTION = "tracking_consent_memory"
const MEMORY_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

export type RememberedChoice = { analytics: boolean; advertising: boolean; personalisation: boolean }

type MemoryDocument = RememberedChoice & {
  _id: string
  version: string
  decidedAt: Date
  updatedAt: Date
}

export type ConsentMemoryMatch =
  | { match: "account"; consent: RememberedChoice & { decidedAt: string } }
  | { match: "network"; consent: null }
  | { match: null; consent: null }

function ipKey(ip: string): string {
  const salt = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || ""
  return `ip:${createHash("sha256").update(`${salt}:tracking-consent:${ip}`).digest("hex")}`
}

const userKey = (userId: string) => `user:${userId}`

function fresh(doc: MemoryDocument | null): doc is MemoryDocument {
  return !!doc && doc.version === PRIVACY_NOTICE_VERSION &&
    Date.now() - new Date(doc.updatedAt).getTime() < MEMORY_MAX_AGE_MS
}

export async function rememberConsent(params: {
  userId?: string | null
  ip?: string | null
  choice: RememberedChoice
  decidedAt?: Date
}): Promise<void> {
  const keys = [params.userId ? userKey(params.userId) : null, params.ip ? ipKey(params.ip) : null].filter(Boolean) as string[]
  if (!keys.length) return
  const now = new Date()
  const collection = await getCollection<MemoryDocument>(CONSENT_MEMORY_COLLECTION)
  await Promise.all(keys.map(_id => collection.updateOne({ _id }, {
    $set: {
      analytics: params.choice.analytics,
      advertising: params.choice.advertising,
      personalisation: params.choice.personalisation,
      version: PRIVACY_NOTICE_VERSION,
      decidedAt: params.decidedAt ?? now,
      updatedAt: now,
    },
  }, { upsert: true })))
}

/** Finds an earlier decision for this account, else for this network. */
export async function lookupConsent(params: { userId?: string | null; ip?: string | null }): Promise<ConsentMemoryMatch> {
  const collection = await getCollection<MemoryDocument>(CONSENT_MEMORY_COLLECTION)
  if (params.userId) {
    const own = await collection.findOne({ _id: userKey(params.userId) })
    if (fresh(own)) {
      const choice = { analytics: own.analytics, advertising: own.advertising, personalisation: own.personalisation }
      // The person has now been seen on this network too.
      if (params.ip) await rememberConsent({ ip: params.ip, choice, decidedAt: own.decidedAt })
      return { match: "account", consent: { ...choice, decidedAt: new Date(own.decidedAt).toISOString() } }
    }
  }
  if (params.ip && fresh(await collection.findOne({ _id: ipKey(params.ip) }))) {
    return { match: "network", consent: null }
  }
  return { match: null, consent: null }
}
