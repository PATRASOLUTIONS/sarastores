import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { requireCron } from "@/lib/cron-auth"
import { CRON_GROUPS, isCronGroup, runCronGroup } from "@/lib/cron/jobs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Runs a whole group of nightly jobs in one invocation.
 *
 * This exists because Vercel's Hobby plan caps a project at two cron entries
 * while the platform has six nightly jobs. Grouping keeps every job scheduled
 * instead of silently dropping four of them.
 *
 * `?dryRun=1` previews without sending email or deleting anything — always run
 * that first against production data.
 *
 * A partially completed group is not an error state: every job is idempotent,
 * so anything skipped for time runs on the next invocation. The response always
 * reports per-job status, and the HTTP status is 207 when any job failed so a
 * monitor can alert on it.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ group: string }> },
) {
  const guard = requireCron(request)
  if (!guard.ok) return guard.response

  const { group } = await context.params
  if (!isCronGroup(group)) {
    return NextResponse.json(
      { error: "Unknown cron group", known: Object.keys(CRON_GROUPS) },
      { status: 404 },
    )
  }

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1"

    // Leave headroom inside the 60 s platform limit so the report is returned
    // rather than the invocation being killed.
    const report = await runCronGroup(group, { dryRun, budgetMs: 50_000 })

    const failed = report.jobs.filter((j) => j.status === "failed").length
    return NextResponse.json(
      { success: failed === 0, ...report },
      { status: failed === 0 ? 200 : 207 },
    )
  } catch (error) {
    return handleApiError(error, "Failed to run scheduled jobs")
  }
}

/** Vercel Cron issues GET requests; delegate so one handler serves both. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ group: string }> },
) {
  return POST(request, context)
}
