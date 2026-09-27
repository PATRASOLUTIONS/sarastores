import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { requireCron } from "@/lib/cron-auth"
import { recomputeSegments } from "@/lib/retention/segmentation"

export const dynamic = "force-dynamic"

/** Recomputes RFM scores and segment membership for every customer profile. */
export async function POST(request: NextRequest) {
  const guard = requireCron(request)
  if (!guard.ok) return guard.response

  try {
    const result = await recomputeSegments()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error, "Failed to recompute segments")
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
