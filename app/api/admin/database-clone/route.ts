import { NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { CloneActionSchema, CloneSafetyError } from "@/lib/database-clone-policy"
import { advanceClone, cloneStatus, startClone } from "@/lib/database-clone"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function failure(error: unknown) {
  if (error instanceof CloneSafetyError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } })
  return handleApiError(new Error("Manual clone request failed"), "Manual clone request failed")
}
export async function GET() {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try { return NextResponse.json(await cloneStatus(), { headers: { "Cache-Control": "no-store" } }) } catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  const parsed = CloneActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "A valid action and explicit clone approval are required" }, { status: 400 })
  try {
    const state = parsed.data.action === "start"
      ? await startClone(guard.user.id, parsed.data.approvalToken)
      : await advanceClone(parsed.data.runId)
    return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return failure(error) }
}
