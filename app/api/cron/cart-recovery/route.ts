import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { requireCron } from "@/lib/cron-auth"
import { runCartRecovery } from "@/lib/retention/cart-recovery"

export const dynamic = "force-dynamic"

/**
 * Abandoned-cart recovery. Add `?dryRun=1` to preview without sending.
 *
 * Replaces the disabled `lib/cron/abandoned-cart.ts` node-cron job, which could not
 * run on serverless and had no working send cap.
 */
export async function POST(request: NextRequest) {
  const guard = requireCron(request)
  if (!guard.ok) return guard.response

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1"
    const result = await runCartRecovery({ dryRun })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error, "Failed to run cart recovery")
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
