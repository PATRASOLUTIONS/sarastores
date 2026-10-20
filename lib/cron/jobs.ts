/**
 * The scheduled-job registry.
 *
 * Vercel's Hobby plan allows only two cron entries, but this platform has six
 * nightly jobs. Rather than drop four of them, the jobs are grouped and a
 * single cron invocation runs a whole group in order. The per-job routes under
 * `/api/cron/*` still exist for manual and external triggering.
 *
 * Every job here must be idempotent: a retried or overlapping invocation has to
 * be harmless, because a group that exhausts its time budget is resumed by the
 * next night's run rather than being tracked as partial state.
 */

import { getCollection, COLLECTIONS } from "@/lib/db-service"
import { rebuildCustomerProfile, EARNING_STATUSES } from "@/lib/customer-profile"
import { runCartRecovery } from "@/lib/retention/cart-recovery"
import { runWishlistAlerts } from "@/lib/retention/wishlist-alerts"
import { runLifecycleReminders } from "@/lib/retention/lifecycle"
import { recomputeSegments } from "@/lib/retention/segmentation"
import {
  ensureRetentionIndexes,
  runRetentionSweep,
  anonymiseExpiredOrders,
} from "@/lib/retention/data-retention"

export type JobOptions = { dryRun: boolean }
export type JobResult = Record<string, unknown>

export type CronJob = {
  /** Matches the per-job route segment, so logs line up with `/api/cron/<name>`. */
  name: string
  description: string
  run: (options: JobOptions) => Promise<JobResult>
}

/** Bounded so a single invocation cannot exceed the serverless execution limit. */
const MAX_USERS_PER_RUN = 500

const rebuildProfiles: CronJob = {
  name: "rebuild-profiles",
  description: "Rebuild customer profile rollups from order history",
  async run() {
    const orders = await getCollection(COLLECTIONS.ORDERS)

    // Only customers with realised orders need a rollup.
    const userIds = (await orders.distinct("userId", {
      userId: { $nin: [null, ""] },
      status: { $in: [...EARNING_STATUSES] },
    })) as string[]

    const batch = userIds.slice(0, MAX_USERS_PER_RUN)

    let rebuilt = 0
    let failed = 0
    for (const userId of batch) {
      try {
        await rebuildCustomerProfile(String(userId))
        rebuilt++
      } catch {
        failed++
      }
    }

    return {
      totalCustomers: userIds.length,
      processed: batch.length,
      rebuilt,
      failed,
      truncated: userIds.length > batch.length,
    }
  },
}

const segmentCustomers: CronJob = {
  name: "segment-customers",
  description: "Recompute RFM scores and segment membership",
  // Reads the profiles rebuilt above, so it must run after them.
  run: async () => ({ ...(await recomputeSegments()) }),
}

const dataRetention: CronJob = {
  name: "data-retention",
  description: "Enforce the published retention schedule (DPDP Act 2023, s.8(7))",
  async run({ dryRun }) {
    // Re-asserted every run so a schedule change in code reaches the database
    // without a manual migration step.
    const indexes = await ensureRetentionIndexes()
    const sweep = await runRetentionSweep({ dryRun })
    const orders = await anonymiseExpiredOrders({ dryRun })
    return { indexes, sweep, orders }
  },
}

const cartRecovery: CronJob = {
  name: "cart-recovery",
  description: "Abandoned-cart recovery email (capped at two per cart)",
  run: async ({ dryRun }) => ({ ...(await runCartRecovery({ dryRun })) }),
}

const wishlistAlerts: CronJob = {
  name: "wishlist-alerts",
  description: "Back-in-stock and price-drop alerts for wishlisted products",
  run: async ({ dryRun }) => ({ ...(await runWishlistAlerts({ dryRun })) }),
}

const lifecycleReminders: CronJob = {
  name: "lifecycle-reminders",
  description: "Warranty, service, replenishment, accessory and win-back reminders",
  run: async ({ dryRun }) => ({ ...(await runLifecycleReminders({ dryRun })) }),
}

/**
 * Jobs that only touch our own derived data are grouped separately from jobs
 * that send messages to customers, so a failure in one group cannot stop the
 * other and the blast radius of a bad deploy is halved.
 */
export const CRON_GROUPS = {
  maintenance: [rebuildProfiles, segmentCustomers, dataRetention],
  outreach: [cartRecovery, wishlistAlerts, lifecycleReminders],
} satisfies Record<string, CronJob[]>

export type CronGroup = keyof typeof CRON_GROUPS

export function isCronGroup(value: string): value is CronGroup {
  return Object.prototype.hasOwnProperty.call(CRON_GROUPS, value)
}

export type JobOutcome = {
  job: string
  status: "ok" | "failed" | "skipped"
  ms: number
  result?: JobResult
  error?: string
}

/**
 * Run a group in order, isolating each job so one failure cannot abort the
 * rest.
 *
 * `budgetMs` stops *starting* further jobs once the elapsed time passes the
 * budget. It cannot interrupt a job already in flight — the point is to return
 * a truthful report instead of being killed mid-write when the platform's
 * execution limit expires.
 */
export async function runCronGroup(
  group: CronGroup,
  options: JobOptions & { budgetMs?: number },
): Promise<{ group: CronGroup; dryRun: boolean; totalMs: number; jobs: JobOutcome[] }> {
  const { dryRun, budgetMs = 50_000 } = options
  const startedAt = Date.now()
  const jobs: JobOutcome[] = []

  for (const job of CRON_GROUPS[group]) {
    const elapsed = Date.now() - startedAt
    if (elapsed > budgetMs) {
      jobs.push({ job: job.name, status: "skipped", ms: 0, error: "time budget exhausted" })
      continue
    }

    const jobStart = Date.now()
    try {
      const result = await job.run({ dryRun })
      jobs.push({ job: job.name, status: "ok", ms: Date.now() - jobStart, result })
    } catch (error) {
      // Logged server-side; the response carries only the message.
      console.error(`[cron:${group}] ${job.name} failed:`, error)
      jobs.push({
        job: job.name,
        status: "failed",
        ms: Date.now() - jobStart,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { group, dryRun, totalMs: Date.now() - startedAt, jobs }
}
