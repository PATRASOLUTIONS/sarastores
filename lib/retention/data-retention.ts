/**
 * Storage-limitation enforcement — DPDP Act 2023, s.8(7).
 *
 * A Data Fiduciary must erase personal data once the purpose it was collected
 * for is served and no law requires it to be kept. Publishing a retention
 * schedule is not enough; it has to actually execute. This module is the
 * executing half of `RETENTION_SCHEDULE`, so the published policy and the real
 * behaviour cannot drift apart.
 *
 * Two mechanisms, deliberately:
 *   - MongoDB TTL indexes delete expired documents continuously, with no cron
 *     dependency. This is the primary mechanism.
 *   - The sweep below is a backstop for documents written before the index
 *     existed (TTL only evicts on its own schedule and skips documents whose
 *     timestamp field is missing or not a BSON date).
 */

import { connectToDatabase } from "@/lib/mongodb"
import { RETENTION_SCHEDULE, type RetentionRule } from "@/lib/dpdp-config"

const DAY_MS = 24 * 60 * 60 * 1000

/** Rules that actually expire on a timer. */
export function timedRules(): Array<RetentionRule & { days: number; timestampField: string }> {
  return RETENTION_SCHEDULE.filter(
    (rule): rule is RetentionRule & { days: number; timestampField: string } =>
      typeof rule.days === "number" && rule.days > 0 && typeof rule.timestampField === "string",
  )
}

export type TtlResult = {
  collection: string
  index: string
  action: "created" | "already-correct" | "recreated" | "failed"
  error?: string
}

/**
 * Create (or correct) a TTL index for every timed rule.
 *
 * `expireAfterSeconds` cannot be changed by re-issuing `createIndex` with a
 * different value — Mongo raises `IndexOptionsConflict` — so a changed
 * retention period means dropping and recreating.
 */
export async function ensureRetentionIndexes(): Promise<TtlResult[]> {
  const { db } = await connectToDatabase()
  const results: TtlResult[] = []

  for (const rule of timedRules()) {
    const name = `dpdp_ttl_${rule.timestampField}`
    const expireAfterSeconds = rule.days * 24 * 60 * 60
    const collection = db.collection(rule.collection)

    try {
      const existing = await collection.indexes().catch(() => [])
      const current = existing.find((index) => index.name === name)

      if (current && current.expireAfterSeconds === expireAfterSeconds) {
        results.push({ collection: rule.collection, index: name, action: "already-correct" })
        continue
      }

      if (current) {
        await collection.dropIndex(name)
        await collection.createIndex({ [rule.timestampField]: 1 }, { name, expireAfterSeconds })
        results.push({ collection: rule.collection, index: name, action: "recreated" })
        continue
      }

      await collection.createIndex({ [rule.timestampField]: 1 }, { name, expireAfterSeconds })
      results.push({ collection: rule.collection, index: name, action: "created" })
    } catch (error) {
      results.push({
        collection: rule.collection,
        index: name,
        action: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
}

export type SweepResult = {
  collection: string
  retention: string
  cutoff: string
  expired: number
  deleted: number
  error?: string
}

/**
 * Delete anything already past its retention period.
 *
 * `dryRun` reports what would go without touching it — always run that first
 * against production data.
 */
export async function runRetentionSweep(options: { dryRun?: boolean } = {}): Promise<{
  dryRun: boolean
  ranAt: string
  totalDeleted: number
  results: SweepResult[]
}> {
  const dryRun = Boolean(options.dryRun)
  const { db } = await connectToDatabase()
  const results: SweepResult[] = []
  let totalDeleted = 0

  for (const rule of timedRules()) {
    const cutoff = new Date(Date.now() - rule.days * DAY_MS)
    // Documents whose timestamp is missing are left alone: without a date there
    // is no way to tell whether they are expired, and deleting them would be a
    // guess. They are reported by `auditRetention()` instead.
    const filter = { [rule.timestampField]: { $lt: cutoff, $ne: null } }

    try {
      const expired = await db.collection(rule.collection).countDocuments(filter)
      let deleted = 0
      if (expired > 0 && !dryRun) {
        const outcome = await db.collection(rule.collection).deleteMany(filter)
        deleted = outcome.deletedCount
        totalDeleted += deleted
      }
      results.push({
        collection: rule.collection,
        retention: rule.retention,
        cutoff: cutoff.toISOString(),
        expired,
        deleted,
      })
    } catch (error) {
      results.push({
        collection: rule.collection,
        retention: rule.retention,
        cutoff: cutoff.toISOString(),
        expired: 0,
        deleted: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { dryRun, ranAt: new Date().toISOString(), totalDeleted, results }
}

/**
 * Anonymise order records that are past the 72-month GST retention period.
 *
 * The financial record itself is kept — a business may need it beyond the
 * statutory minimum — but once the legal obligation expires there is no longer
 * a lawful basis to keep the customer's identity attached to it.
 */
export async function anonymiseExpiredOrders(options: { dryRun?: boolean } = {}): Promise<{
  matched: number
  anonymised: number
}> {
  const dryRun = Boolean(options.dryRun)
  const { db } = await connectToDatabase()
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 72)

  const filter = {
    createdAt: { $lt: cutoff },
    customerAnonymisedAt: { $exists: false },
  }

  const matched = await db.collection("orders").countDocuments(filter)
  if (dryRun || matched === 0) return { matched, anonymised: 0 }

  const outcome = await db.collection("orders").updateMany(filter, {
    $set: {
      "customer.firstName": "Expired",
      "customer.lastName": "record",
      "customer.name": "Expired record",
      "customer.email": null,
      "customer.phone": null,
      "customer.address": "",
      "customer.city": "",
      "customer.zipCode": "",
      "shippingAddress.name": "Expired record",
      "shippingAddress.street": "",
      "shippingAddress.address": "",
      "shippingAddress.city": "",
      "shippingAddress.zip": "",
      notes: "",
      customerAnonymisedAt: new Date(),
      anonymisationReason: "gst_retention_expired",
    },
  })

  return { matched, anonymised: outcome.modifiedCount }
}

/** Read-only compliance view: what is overdue right now, per collection. */
export async function auditRetention(): Promise<
  Array<{ collection: string; retention: string; total: number; overdue: number; undated: number }>
> {
  const { db } = await connectToDatabase()
  const rows = []

  for (const rule of timedRules()) {
    const cutoff = new Date(Date.now() - rule.days * DAY_MS)
    try {
      const collection = db.collection(rule.collection)
      rows.push({
        collection: rule.collection,
        retention: rule.retention,
        total: await collection.estimatedDocumentCount(),
        overdue: await collection.countDocuments({ [rule.timestampField]: { $lt: cutoff, $ne: null } }),
        undated: await collection.countDocuments({ [rule.timestampField]: { $exists: false } }),
      })
    } catch {
      /* collection may not exist in this environment */
    }
  }

  return rows
}
