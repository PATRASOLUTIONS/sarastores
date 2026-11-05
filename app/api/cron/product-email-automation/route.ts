import { type NextRequest, NextResponse } from "next/server"
import { requireCron } from "@/lib/cron-auth"
import { handleApiError } from "@/lib/api-error"
import { runProductEmailAutomation } from "@/lib/product-email-automation"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const guard = requireCron(request)
  if (!guard.ok) return guard.response
  try {
    const result = await runProductEmailAutomation({ dryRun: new URL(request.url).searchParams.get("dryRun") === "1" })
    return NextResponse.json(result, { status: "unknown" in result && (result.unknown || result.failed) ? 207 : 200 })
  } catch (error) { return handleApiError(error, "Daily product email automation failed") }
}
