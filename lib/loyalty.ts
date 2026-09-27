import { getCollection } from "@/lib/db-service"
import { EARNING_STATUSES, tierForSpend, type Tier } from "@/lib/customer-profile"

/**
 * Sara Rewards — points ledger ("LOYALTY PROGRAM" in the BRD).
 *
 * An append-only ledger rather than a running balance column: every earn,
 * redemption, expiry and manual adjustment is a row, and the balance is the
 * sum. That makes disputes answerable and means a double-write can be detected
 * instead of silently inflating someone's points.
 *
 * Points are minted only when an order reaches a status in `EARNING_STATUSES`,
 * so a cancelled or undelivered order never pays out.
 */

export const LOYALTY_LEDGER_COLLECTION = "loyalty_ledger"

export type LedgerEntryType = "earn" | "redeem" | "expire" | "adjust" | "reverse"

export interface LoyaltyEntry {
  id: string
  userId: string
  type: LedgerEntryType
  /** Positive for credits, negative for debits. */
  points: number
  orderId: string | null
  reason: string
  createdAt: string
  expiresAt: string | null
}

export interface LoyaltyBalance {
  userId: string
  balance: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  tier: Tier
  /** Points per ₹100 at the customer's current tier. */
  earnRate: number
  /** Points that lapse within the next 30 days. */
  expiringSoon: number
}

// ── Business rules ────────────────────────────────────────────────────────
// Config, not law. Change here and the whole programme moves.

/** Base points granted per ₹100 of realised spend. */
const BASE_POINTS_PER_100 = 2

/** Tier multiplier on the base earn rate. */
const TIER_MULTIPLIER: Record<Tier, number> = {
  silver: 1,
  gold: 1.5,
  platinum: 2,
}

/** Rupee value of one point when redeemed. */
export const POINT_VALUE_INR = 0.25

/** A redemption can never cover more than this share of an order. */
export const MAX_REDEMPTION_RATIO = 0.2

/** Redemptions come in round lots so the arithmetic stays legible. */
export const REDEMPTION_STEP = 100

/** Points lapse this long after being earned. */
const POINT_LIFETIME_DAYS = 365

export function earnRateForTier(tier: Tier): number {
  return BASE_POINTS_PER_100 * TIER_MULTIPLIER[tier]
}

/** Points earned on a realised order total, floored. */
export function pointsForSpend(amount: number, tier: Tier): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.floor((amount / 100) * earnRateForTier(tier))
}

export function pointsToInr(points: number): number {
  return Math.floor(Math.max(0, points) * POINT_VALUE_INR)
}

/** Largest redeemable lot for an order, respecting balance, cap and step. */
export function maxRedeemablePoints(balance: number, orderTotal: number): number {
  const capInr = orderTotal * MAX_REDEMPTION_RATIO
  const capPoints = Math.floor(capInr / POINT_VALUE_INR)
  const usable = Math.min(balance, capPoints)
  return Math.max(0, Math.floor(usable / REDEMPTION_STEP) * REDEMPTION_STEP)
}

function toEntry(doc: any): LoyaltyEntry {
  return {
    id: doc._id?.toString?.() || "",
    userId: String(doc.userId || ""),
    type: doc.type,
    points: Number(doc.points) || 0,
    orderId: doc.orderId ? String(doc.orderId) : null,
    reason: doc.reason || "",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
  }
}

/**
 * Balance is computed from the ledger every time rather than cached, so it can
 * never drift from the entries that justify it.
 */
export async function getLoyaltyBalance(userId: string): Promise<LoyaltyBalance> {
  const collection = await getCollection(LOYALTY_LEDGER_COLLECTION)
  const entries = await collection.find({ userId }).toArray()

  let balance = 0
  let lifetimeEarned = 0
  let lifetimeRedeemed = 0
  let expiringSoon = 0

  const now = Date.now()
  const soon = now + 30 * 24 * 60 * 60 * 1000

  for (const doc of entries) {
    const points = Number(doc.points) || 0
    balance += points
    if (points > 0) lifetimeEarned += points
    else lifetimeRedeemed += Math.abs(points)

    if (points > 0 && doc.expiresAt) {
      const expiresAt = new Date(doc.expiresAt).getTime()
      if (expiresAt > now && expiresAt <= soon) expiringSoon += points
    }
  }

  // Tier comes from realised spend, which the profile rollup already tracks.
  let tier: Tier = "silver"
  try {
    const profiles = await getCollection("customer_profiles")
    const profile = await profiles.findOne({ userId })
    tier = profile?.tier || tierForSpend(Number(profile?.spendLast365) || 0)
  } catch {
    // Missing profile just means silver.
  }

  return {
    userId,
    balance: Math.max(0, balance),
    lifetimeEarned,
    lifetimeRedeemed,
    tier,
    earnRate: earnRateForTier(tier),
    expiringSoon,
  }
}

export async function getLoyaltyHistory(userId: string, limit = 50): Promise<LoyaltyEntry[]> {
  const collection = await getCollection(LOYALTY_LEDGER_COLLECTION)
  const docs = await collection
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .toArray()
  return docs.map(toEntry)
}

/**
 * Credit points for a delivered order.
 *
 * Idempotent on `(userId, orderId, type: "earn")` — the status webhook and a
 * manual admin update can both call this without paying twice.
 */
export async function awardPointsForOrder(opts: {
  userId: string
  orderId: string
  orderTotal: number
  status: string
}): Promise<number> {
  if (!opts.userId || !opts.orderId) return 0
  if (!(EARNING_STATUSES as readonly string[]).includes(opts.status)) return 0

  const collection = await getCollection(LOYALTY_LEDGER_COLLECTION)

  const existing = await collection.findOne({
    userId: opts.userId,
    orderId: opts.orderId,
    type: "earn",
  })
  if (existing) return 0

  const { tier } = await getLoyaltyBalance(opts.userId)
  const points = pointsForSpend(opts.orderTotal, tier)
  if (points <= 0) return 0

  await collection.insertOne({
    userId: opts.userId,
    type: "earn",
    points,
    orderId: opts.orderId,
    reason: `Order ${opts.orderId} delivered`,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + POINT_LIFETIME_DAYS * 24 * 60 * 60 * 1000),
  })

  return points
}

/**
 * Validate a redemption without writing to the ledger.
 *
 * Checkout needs the discount before the payment amount is fixed, but the
 * points must not be debited until an order actually exists. Quote first,
 * commit after.
 */
export async function quoteRedemption(opts: {
  userId: string
  points: number
  orderTotal: number
}): Promise<{ ok: true; points: number; discount: number } | { ok: false; error: string }> {
  const requested = Math.floor(Number(opts.points) || 0)
  if (requested <= 0) return { ok: false, error: "No points to redeem" }
  if (requested % REDEMPTION_STEP !== 0) {
    return { ok: false, error: `Points must be redeemed in multiples of ${REDEMPTION_STEP}` }
  }

  const { balance } = await getLoyaltyBalance(opts.userId)
  const allowed = maxRedeemablePoints(balance, opts.orderTotal)

  if (requested > allowed) {
    return {
      ok: false,
      error:
        requested > balance
          ? "Not enough points"
          : `You can redeem at most ${allowed} points on this order`,
    }
  }

  return { ok: true, points: requested, discount: pointsToInr(requested) }
}

/**
 * Debit points against an order. Re-quotes inside the call so a stale
 * client-side balance can never overdraw the account.
 */
export async function redeemPoints(opts: {
  userId: string
  orderId: string
  points: number
  orderTotal: number
}): Promise<{ ok: true; points: number; discount: number } | { ok: false; error: string }> {
  const quote = await quoteRedemption(opts)
  if (!quote.ok) return quote

  const collection = await getCollection(LOYALTY_LEDGER_COLLECTION)

  // Same guard as earning: one redemption per order.
  const existing = await collection.findOne({
    userId: opts.userId,
    orderId: opts.orderId,
    type: "redeem",
  })
  if (existing) return { ok: false, error: "Points have already been redeemed on this order" }

  await collection.insertOne({
    userId: opts.userId,
    type: "redeem",
    points: -quote.points,
    orderId: opts.orderId,
    reason: `Redeemed on order ${opts.orderId}`,
    createdAt: new Date(),
    expiresAt: null,
  })

  return quote
}

/** Return points to the customer when an order is cancelled or refunded. */
export async function reverseOrderPoints(userId: string, orderId: string): Promise<void> {
  const collection = await getCollection(LOYALTY_LEDGER_COLLECTION)
  const entries = await collection.find({ userId, orderId }).toArray()

  for (const entry of entries) {
    if (entry.type === "reverse") continue
    const already = await collection.findOne({
      userId,
      orderId,
      type: "reverse",
      reason: `Reversal of ${entry._id.toString()}`,
    })
    if (already) continue

    await collection.insertOne({
      userId,
      type: "reverse",
      points: -Number(entry.points || 0),
      orderId,
      reason: `Reversal of ${entry._id.toString()}`,
      createdAt: new Date(),
      expiresAt: null,
    })
  }
}
