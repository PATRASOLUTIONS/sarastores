import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { requireCron } from "@/lib/cron-auth"
import {
  ensureRetentionIndexes,
  runRetentionSweep,
  anonymiseExpiredOrders,
} from "@/lib/retention/data-retention"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Enforces the published retention schedule — DPDP Act 2023, s.8(7).
 *
 * Idempotent and safe to run daily. `?dryRun=1` reports what would be deleted
 * without deleting anything; run that first after any change to the schedule.
 */
export async function POST(request: NextRequest) {
  const guard = requireCron(request)
  if (!guard.ok) return guard.response

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1"

    // Re-asserted every run so a schedule change in code reaches the database
    // without a manual migration step.
    const indexes = await ensureRetentionIndexes()
    const sweep = await runRetentionSweep({ dryRun })
    const orders = await anonymiseExpiredOrders({ dryRun })

    return NextResponse.json({ success: true, dryRun, indexes, sweep, orders })
  } catch (error) {
    return handleApiError(error, "Failed to run data retention")
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
