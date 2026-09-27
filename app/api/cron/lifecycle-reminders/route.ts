import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { requireCron } from "@/lib/cron-auth"
import { runLifecycleReminders } from "@/lib/retention/lifecycle"

export const dynamic = "force-dynamic"

/**
 * Sends warranty, service, replenishment, accessory and win-back reminders.
 *
 * Add `?dryRun=1` to see exactly what would be sent without sending it — always
 * do this first against production data.
 */
export async function POST(request: NextRequest) {
  const guard = requireCron(request)
  if (!guard.ok) return guard.response

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1"
    const result = await runLifecycleReminders({ dryRun })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error, "Failed to run lifecycle reminders")
  }
}

/** Vercel Cron issues GET requests. */
export async function GET(request: NextRequest) {
  return POST(request)
}
