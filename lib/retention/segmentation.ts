/**
 * RFM segmentation — Strategy 9.
 *
 * Customers are scored 1–5 on Recency, Frequency and Monetary value, then mapped
 * onto named segments the business can act on. Scoring uses fixed thresholds rather
 * than quintiles: with a catalogue this size quintiles move every night, so a
 * customer would drift between segments without changing behaviour, and campaign
 * membership would never be stable enough to measure.
 */

import { getCollection, normalizeId } from "@/lib/db-service"
import { COLLECTION_CUSTOMER_PROFILES } from "@/lib/customer-profile"

export const SEGMENTS = [
  "champion",
  "loyal",
  "promising",
  "at_risk",
  "lapsed",
  "lost",
] as const

export type Segment = (typeof SEGMENTS)[number]

export const SEGMENT_LABELS: Record<Segment, string> = {
  champion: "Champions",
  loyal: "Loyal",
  promising: "Promising",
  at_risk: "At risk",
  lapsed: "Lapsed",
  lost: "Lost",
}

/** Days since last purchase → recency score (5 = most recent). */
function recencyScore(days: number | null): number {
  if (days === null) return 1
  if (days <= 30) return 5
  if (days <= 90) return 4
  if (days <= 180) return 3
  if (days <= 365) return 2
  return 1
}

function frequencyScore(orders: number): number {
  if (orders >= 10) return 5
  if (orders >= 6) return 4
  if (orders >= 3) return 3
  if (orders >= 2) return 2
  return 1
}

/** Rupee thresholds tuned for electronics, where a single order can be large. */
function monetaryScore(spend: number): number {
  if (spend >= 200000) return 5
  if (spend >= 100000) return 4
  if (spend >= 50000) return 3
  if (spend >= 15000) return 2
  return 1
}

export type RfmScores = { recency: number; frequency: number; monetary: number }

export function scoreCustomer(input: {
  lastOrderAt: Date | string | null
  orderCount: number
  lifetimeSpend: number
  now?: Date
}): RfmScores {
  const now = input.now ?? new Date()
  const last = input.lastOrderAt ? new Date(input.lastOrderAt) : null
  const daysSince =
    last && !Number.isNaN(last.getTime())
      ? Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
      : null

  return {
    recency: recencyScore(daysSince),
    frequency: frequencyScore(Number(input.orderCount) || 0),
    monetary: monetaryScore(Number(input.lifetimeSpend) || 0),
  }
}

/**
 * Map scores onto a segment. Recency dominates deliberately: a high-value customer
 * who has not bought in a year is a retention problem, not a champion.
 */
export function segmentFor(scores: RfmScores): Segment {
  const { recency, frequency, monetary } = scores
  const value = Math.max(frequency, monetary)

  if (recency >= 4 && value >= 4) return "champion"
  if (recency >= 4 && value >= 2) return "loyal"
  if (recency >= 4) return "promising"
  if (recency === 3) return "at_risk"
  if (recency === 2) return "lapsed"
  return "lost"
}

/** Segments worth spending win-back budget on — "lost" is usually not economic. */
export const WINBACK_SEGMENTS: Segment[] = ["at_risk", "lapsed"]

/**
 * Recompute segments for a batch of profiles. Idempotent, so a re-run or an
 * overlapping invocation cannot corrupt state.
 */
export async function recomputeSegments(limit = 1000): Promise<{
  processed: number
  counts: Record<string, number>
}> {
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)

  const docs = await profiles
    .find({}, { projection: { userId: 1, lastOrderAt: 1, orderCount: 1, lifetimeSpend: 1 } })
    .limit(limit)
    .toArray()

  const now = new Date()
  const counts: Record<string, number> = {}
  let processed = 0

  for (const doc of docs) {
    const scores = scoreCustomer({
      lastOrderAt: (doc.lastOrderAt as Date) ?? null,
      orderCount: Number(doc.orderCount) || 0,
      lifetimeSpend: Number(doc.lifetimeSpend) || 0,
      now,
    })
    const segment = segmentFor(scores)
    counts[segment] = (counts[segment] ?? 0) + 1

    await profiles.updateOne(
      { _id: doc._id },
      { $set: { segment, rfm: scores, segmentUpdatedAt: now, updatedAt: now } },
    )
    processed++
  }

  return { processed, counts }
}

/** Segment totals for the admin overview. */
export async function getSegmentCounts(): Promise<Record<string, number>> {
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  const rows = await profiles
    .aggregate([{ $group: { _id: "$segment", count: { $sum: 1 } } }])
    .toArray()

  const counts: Record<string, number> = {}
  for (const row of rows) {
    counts[String(row._id ?? "unsegmented")] = Number(row.count) || 0
  }
  return counts
}

/** Contactable customers in a segment, for win-back campaigns. */
export async function getSegmentMembers(
  segment: Segment,
  channel: "email" | "whatsapp" = "email",
  limit = 200,
) {
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  const docs = await profiles
    .find(
      { segment, [`consent.${channel}`]: true },
      { projection: { unsubscribeTokenHash: 0 } },
    )
    .limit(limit)
    .toArray()
  return normalizeId(docs)
}
