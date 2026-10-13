import { getCollection } from "@/lib/db-service"
import { EARNING_STATUSES, tierForSpend, type Tier } from "@/lib/customer-profile"
import { ObjectId, type ClientSession } from "mongodb"

/**
 * Sara Coins: cumulative realised orders determine earnings. The append-only
 * ledger retains redemption, refund and adjustment history. Historical earn
 * amounts are repriced from orders so changing rates never requires a destructive
 * migration and replayed status callbacks cannot inflate the balance.
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
  /** Coins per ₹1,000; the same rate applies to every member. */
  earnRate: number
  eligibleSpend: number
  spendToNextCoin: number
  /** Points that lapse within the next 30 days. */
  expiringSoon: number
}

// ── Business rules ────────────────────────────────────────────────────────
// Config, not law. Change here and the whole programme moves.

export const SPEND_PER_COIN_INR = 1000

/** Rupee value of one point when redeemed. */
export const POINT_VALUE_INR = 0.25

/** A redemption can never cover more than this share of an order. */
export const MAX_REDEMPTION_RATIO = 0.2

/** Redemptions come in round lots so the arithmetic stays legible. */
export const REDEMPTION_STEP = 100

/** Points lapse this long after being earned. */
export const POINT_LIFETIME_DAYS = 365

export function earnRateForTier(_tier: Tier): number {
  return 1
}

/** Points earned on a realised order total, floored. */
export function pointsForSpend(amount: number, _tier?: Tier): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.floor(Math.round(amount * 100) / (SPEND_PER_COIN_INR * 100))
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

interface LoyaltyLedgerDocument {
  _id?: ObjectId | string
  userId?: string
  type: LedgerEntryType
  points: number | string
  orderId?: string | null
  reason?: string | null
  createdAt?: Date | string | null
  expiresAt?: Date | string | null
}

function toEntry(doc: LoyaltyLedgerDocument): LoyaltyEntry {
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
 * Calculate cumulative credits in paise, preserving the remainder across orders.
 * Consume credits oldest-first so redeemed coins cannot expire a second time.
 */
export async function getLoyaltySnapshot(userId: string, session?: ClientSession): Promise<LoyaltyBalance & { history: LoyaltyEntry[] }> {
  const [ledger, ordersCollection] = await Promise.all([
    getCollection<LoyaltyLedgerDocument>(LOYALTY_LEDGER_COLLECTION), getCollection("orders"),
  ])
  const documents = await ledger.find({ userId }, { session }).toArray()
  const orders = await ordersCollection.find({ userId, status: { $in: [...EARNING_STATUSES] } }, { session })
    .project({ total: 1, orderId: 1, createdAt: 1, deliveredAt: 1 }).toArray()
  const now = Date.now()
  const year = POINT_LIFETIME_DAYS * 86400000
  const eligible = orders.map(order => {
    const total = Number(order.total)
    const date = new Date(order.deliveredAt || order.createdAt).getTime()
    if (!Number.isFinite(total) || total < 0 || !Number.isFinite(date)) throw new Error("Invalid order data in rewards calculation")
    return { id: String(order.orderId || order._id), cents: Math.round(total * 100), date }
  }).sort((a, b) => a.date - b.date || a.id.localeCompare(b.id))

  // Reprice past earnings from authoritative orders, without rewriting the
  // ledger or paying twice when an admin replays a delivery status update.
  let spentCents = 0
  let annualSpend = 0
  const earned: LoyaltyEntry[] = []
  for (const order of eligible) {
    const before = Math.floor(spentCents / (SPEND_PER_COIN_INR * 100))
    spentCents += order.cents
    const points = Math.floor(spentCents / (SPEND_PER_COIN_INR * 100)) - before
    if (order.date > now - year) annualSpend += order.cents / 100
    if (points > 0) earned.push({
      id: `order-${order.id}`, userId, type: "earn", points, orderId: order.id,
      reason: `Sara Coins earned on order ${order.id}`, createdAt: new Date(order.date).toISOString(),
      expiresAt: new Date(order.date + year).toISOString(),
    })
  }
  const entries = documents.map(toEntry)
  const ignored = new Set(entries.filter(entry => entry.type === "earn" || entry.type === "expire").map(entry => `Reversal of ${entry.id}`))
  const debits = entries.filter(entry => entry.type !== "earn" && entry.type !== "expire" &&
    !(entry.type === "reverse" && ignored.has(entry.reason)))
  const redemptionReversals = new Set(entries.filter(entry => entry.type === "redeem").map(entry => `Reversal of ${entry.id}`))
  const history = [...earned, ...debits].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const lots: { remaining: number; expiry: number }[] = []
  let debt = 0
  for (const entry of history) {
    const time = new Date(entry.createdAt).getTime()
    if (entry.points > 0) {
      const offset = Math.min(debt, entry.points)
      debt -= offset
      lots.push({ remaining: entry.points - offset, expiry: entry.expiresAt ? new Date(entry.expiresAt).getTime() : Infinity })
    } else {
      let needed = -entry.points
      for (const lot of lots) {
        if (lot.expiry <= time) continue
        const used = Math.min(needed, lot.remaining)
        lot.remaining -= used
        needed -= used
        if (needed === 0) break
      }
      debt += needed
    }
  }
  const available = lots.filter(lot => lot.expiry > now)
  const balance = Math.max(0, available.reduce((sum, lot) => sum + lot.remaining, 0) - debt)
  const expiringSoon = Math.min(balance, available.filter(lot => lot.expiry <= now + 30 * 86400000).reduce((sum, lot) => sum + lot.remaining, 0))
  return {
    userId, balance, lifetimeEarned: Math.floor(spentCents / (SPEND_PER_COIN_INR * 100)),
    lifetimeRedeemed: Math.max(0, -debits.filter(entry => entry.type === "redeem" ||
      (entry.type === "reverse" && redemptionReversals.has(entry.reason))).reduce((sum, entry) => sum + entry.points, 0)),
    eligibleSpend: spentCents / 100, spendToNextCoin: (SPEND_PER_COIN_INR * 100 - spentCents % (SPEND_PER_COIN_INR * 100)) / 100,
    tier: tierForSpend(annualSpend), earnRate: 1, expiringSoon, history: history.reverse().slice(0, 200),
  }
}

export async function getLoyaltyBalance(userId: string, session?: ClientSession): Promise<LoyaltyBalance> {
  const { history: _, ...balance } = await getLoyaltySnapshot(userId, session)
  return balance
}

export async function getLoyaltyHistory(userId: string, limit = 50): Promise<LoyaltyEntry[]> {
  return (await getLoyaltySnapshot(userId)).history.slice(0, Math.min(limit, 200))
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

  const collection = await getCollection<LoyaltyLedgerDocument>(LOYALTY_LEDGER_COLLECTION)

  const existing = await collection.findOne({
    userId: opts.userId,
    orderId: opts.orderId,
    type: "earn",
  })
  if (existing) return 0

  const snapshot = await getLoyaltySnapshot(opts.userId)
  const points = snapshot.history.find(entry => entry.type === "earn" && entry.orderId === opts.orderId)?.points || 0
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
  session?: ClientSession
}): Promise<{ ok: true; points: number; discount: number } | { ok: false; error: string }> {
  const requested = Math.floor(Number(opts.points) || 0)
  if (requested <= 0) return { ok: false, error: "No points to redeem" }
  if (requested % REDEMPTION_STEP !== 0) {
    return { ok: false, error: `Points must be redeemed in multiples of ${REDEMPTION_STEP}` }
  }

  const { balance } = await getLoyaltyBalance(opts.userId, opts.session)
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
  session?: ClientSession
}): Promise<{ ok: true; points: number; discount: number } | { ok: false; error: string }> {
  if (opts.session) {
    const users = await getCollection("users")
    const result = await users.updateOne(
      { _id: new ObjectId(opts.userId) },
      { $inc: { loyaltyRevision: 1 } },
      { session: opts.session },
    )
    if (!result.matchedCount) return { ok: false, error: "Account is unavailable" }
  }
  const quote = await quoteRedemption(opts)
  if (!quote.ok) return quote

  const collection = await getCollection<LoyaltyLedgerDocument>(LOYALTY_LEDGER_COLLECTION)

  // Same guard as earning: one redemption per order.
  const existing = await collection.findOne({
    userId: opts.userId,
    orderId: opts.orderId,
    type: "redeem",
  }, { session: opts.session })
  if (existing) return { ok: false, error: "Points have already been redeemed on this order" }

  await collection.insertOne({
    userId: opts.userId,
    type: "redeem",
    points: -quote.points,
    orderId: opts.orderId,
    reason: `Redeemed on order ${opts.orderId}`,
    createdAt: new Date(),
    expiresAt: null,
  }, { session: opts.session })

  return quote
}

/** Return points to the customer when an order is cancelled or refunded. */
export async function reverseOrderPoints(userId: string, orderId: string): Promise<void> {
  const collection = await getCollection<LoyaltyLedgerDocument>(LOYALTY_LEDGER_COLLECTION)
  const entries = await collection.find({ userId, orderId }).toArray()

  for (const entry of entries) {
    if (entry.type === "reverse" || entry.type === "earn" || entry.type === "expire") continue
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
