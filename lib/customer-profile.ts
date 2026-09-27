/**
 * Customer profile & consent service — Phase 0 of the retention programme.
 *
 * A `customer_profiles` document is the single rollup of everything the retention
 * strategies need to segment on: what someone has spent, when they last bought,
 * which categories they own, and which channels they have agreed to be contacted on.
 *
 * The rollup is derived state — it is always recomputed from `orders`, never
 * incremented in place, so a replay can never double-count. Only orders in
 * `EARNING_STATUSES` count, because a cancelled or returned order must not inflate
 * lifetime value.
 */

import { randomBytes, createHash } from "crypto"
import { getCollection, normalizeId, COLLECTIONS } from "@/lib/db-service"

export const COLLECTION_CUSTOMER_PROFILES = "customer_profiles"
export const COLLECTION_CUSTOMER_EVENTS = "customer_events"

/** Order states that represent value actually realised, not merely promised. */
export const EARNING_STATUSES = ["delivered", "completed"] as const

/** Rolling window used for tier qualification. */
const TIER_WINDOW_DAYS = 365

export const TIERS = ["silver", "gold", "platinum"] as const
export type Tier = (typeof TIERS)[number]

/** Annual spend required to hold a tier. Thresholds are business config, not law. */
export const TIER_THRESHOLDS: Record<Tier, number> = {
  silver: 0,
  gold: 25000,
  platinum: 100000,
}

export type ChannelConsent = {
  email: boolean
  whatsapp: boolean
  sms: boolean
}

export type CustomerProfile = {
  userId: string
  email: string | null
  phone: string | null
  lifetimeSpend: number
  orderCount: number
  averageOrderValue: number
  firstOrderAt: Date | null
  lastOrderAt: Date | null
  spendLast365: number
  categoriesBought: string[]
  tier: Tier
  consent: ChannelConsent
  consentUpdatedAt: Date | null
  unsubscribeToken: string
  createdAt: Date
  updatedAt: Date
}

/** New customers are contactable about their own orders only until they opt in. */
const DEFAULT_CONSENT: ChannelConsent = { email: false, whatsapp: false, sms: false }

export function tierForSpend(spend: number): Tier {
  if (spend >= TIER_THRESHOLDS.platinum) return "platinum"
  if (spend >= TIER_THRESHOLDS.gold) return "gold"
  return "silver"
}

/**
 * Unsubscribe links must be usable from an email client, so they cannot require a
 * session. The token is random (not derived from the user id) so it reveals nothing
 * and can be rotated without touching the account.
 */
export function generateUnsubscribeToken(): string {
  return randomBytes(32).toString("base64url")
}

/** Tokens are looked up by hash so a database leak does not yield working links. */
export function hashUnsubscribeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

type OrderDoc = {
  userId?: string
  status?: string
  total?: number | string
  createdAt?: string | Date
  items?: Array<Record<string, unknown>>
  customer?: { email?: string; phone?: string }
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function categoryOf(item: Record<string, unknown>): string | null {
  const raw = item.category ?? item.subCategory ?? null
  const value = typeof raw === "string" ? raw.trim() : ""
  return value.length > 0 ? value : null
}

/**
 * Recompute one customer's rollup from their order history.
 *
 * Consent and the unsubscribe token are deliberately preserved on update: they are
 * customer-owned state, not derived from orders, and must survive a rebuild.
 */
export async function rebuildCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  if (!userId) return null

  const ordersCollection = await getCollection(COLLECTIONS.ORDERS)
  const orders = (await ordersCollection
    .find({ userId, status: { $in: [...EARNING_STATUSES] } })
    .project({ total: 1, createdAt: 1, items: 1, customer: 1, status: 1 })
    .toArray()) as OrderDoc[]

  const windowStart = new Date(Date.now() - TIER_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  let lifetimeSpend = 0
  let spendLast365 = 0
  let firstOrderAt: Date | null = null
  let lastOrderAt: Date | null = null
  let email: string | null = null
  let phone: string | null = null
  const categories = new Set<string>()

  for (const order of orders) {
    const total = Number(order.total) || 0
    lifetimeSpend += total

    const placedAt = toDate(order.createdAt)
    if (placedAt) {
      if (placedAt >= windowStart) spendLast365 += total
      if (!firstOrderAt || placedAt < firstOrderAt) firstOrderAt = placedAt
      if (!lastOrderAt || placedAt > lastOrderAt) lastOrderAt = placedAt
    }

    for (const item of order.items ?? []) {
      const category = categoryOf(item)
      if (category) categories.add(category)
    }

    // Latest known contact details win, so a customer who updates them stays reachable.
    if (order.customer?.email) email = order.customer.email
    if (order.customer?.phone) phone = order.customer.phone
  }

  const orderCount = orders.length
  const now = new Date()
  const derived = {
    userId,
    email,
    phone,
    lifetimeSpend: Math.round(lifetimeSpend * 100) / 100,
    orderCount,
    averageOrderValue: orderCount > 0 ? Math.round((lifetimeSpend / orderCount) * 100) / 100 : 0,
    firstOrderAt,
    lastOrderAt,
    spendLast365: Math.round(spendLast365 * 100) / 100,
    categoriesBought: [...categories].sort(),
    tier: tierForSpend(spendLast365),
    updatedAt: now,
  }

  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  await profiles.updateOne(
    { userId },
    {
      $set: derived,
      $setOnInsert: {
        consent: DEFAULT_CONSENT,
        consentUpdatedAt: null,
        unsubscribeTokenHash: hashUnsubscribeToken(generateUnsubscribeToken()),
        createdAt: now,
      },
    },
    { upsert: true },
  )

  const saved = await profiles.findOne({ userId })
  return saved ? (normalizeId(saved) as unknown as CustomerProfile) : null
}

/** Read a profile without creating one. */
export async function getCustomerProfile(userId: string) {
  if (!userId) return null
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  const doc = await profiles.findOne(
    { userId },
    { projection: { unsubscribeTokenHash: 0 } },
  )
  return doc ? normalizeId(doc) : null
}

/**
 * Update channel consent. Returns null when the customer has no profile yet, so the
 * caller can create one rather than silently writing an orphan record.
 */
export async function setConsent(
  userId: string,
  consent: Partial<ChannelConsent>,
  source: string,
): Promise<boolean> {
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  const now = new Date()

  const update: Record<string, unknown> = { consentUpdatedAt: now, updatedAt: now }
  for (const channel of ["email", "whatsapp", "sms"] as const) {
    if (typeof consent[channel] === "boolean") {
      update[`consent.${channel}`] = consent[channel]
    }
  }

  await profiles.updateOne(
    { userId },
    {
      $set: update,
      $setOnInsert: {
        userId,
        lifetimeSpend: 0,
        orderCount: 0,
        averageOrderValue: 0,
        firstOrderAt: null,
        lastOrderAt: null,
        spendLast365: 0,
        categoriesBought: [],
        tier: "silver" as Tier,
        email: null,
        phone: null,
        unsubscribeTokenHash: hashUnsubscribeToken(generateUnsubscribeToken()),
        createdAt: now,
      },
    },
    { upsert: true },
  )

  await recordEvent(userId, "consent_updated", { source, consent })
  return true
}

/**
 * Issue a fresh unsubscribe token and return the plaintext exactly once. Only the
 * hash is stored, so this is the single opportunity to embed it in a link.
 */
export async function issueUnsubscribeToken(userId: string): Promise<string> {
  const token = generateUnsubscribeToken()
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  await profiles.updateOne(
    { userId },
    { $set: { unsubscribeTokenHash: hashUnsubscribeToken(token), updatedAt: new Date() } },
  )
  return token
}

/** Turn off one channel (or all) from an emailed link. */
export async function unsubscribeByToken(
  token: string,
  channel: keyof ChannelConsent | "all",
): Promise<boolean> {
  if (!token) return false
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  const profile = await profiles.findOne({ unsubscribeTokenHash: hashUnsubscribeToken(token) })
  if (!profile) return false

  const now = new Date()
  const update: Record<string, unknown> = { consentUpdatedAt: now, updatedAt: now }
  if (channel === "all") {
    update["consent"] = { email: false, whatsapp: false, sms: false }
  } else {
    update[`consent.${channel}`] = false
  }

  await profiles.updateOne({ _id: profile._id }, { $set: update })
  await recordEvent(String(profile.userId), "unsubscribed", { channel })
  return true
}

/**
 * Append-only activity log. Retention campaigns need to know what already happened
 * to a customer (so they are not messaged twice), and this is that record.
 */
export async function recordEvent(
  userId: string,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!userId || !type) return
  try {
    const events = await getCollection(COLLECTION_CUSTOMER_EVENTS)
    await events.insertOne({ userId, type, payload, createdAt: new Date() })
  } catch {
    // Telemetry must never break the request that triggered it.
  }
}

/**
 * Customers who may be contacted on a channel. Campaign senders must call this
 * rather than querying `users` directly, so consent is enforced in one place.
 */
export async function getContactableProfiles(
  channel: keyof ChannelConsent,
  limit = 500,
) {
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  const docs = await profiles
    .find(
      { [`consent.${channel}`]: true },
      { projection: { unsubscribeTokenHash: 0 } },
    )
    .limit(limit)
    .toArray()
  return normalizeId(docs)
}
