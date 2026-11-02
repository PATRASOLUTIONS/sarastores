import { NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { CloneSafetyError } from "@/lib/database-clone-policy"
import { previewClone } from "@/lib/database-clone"

export const dynamic = "force-dynamic"
export const maxDuration = 60
/** Read-only metadata preview. No destination control records are created here. */
export async function POST() {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try { return NextResponse.json(await previewClone(guard.user.id), { headers: { "Cache-Control": "no-store" } }) }
  catch (error) {
    if (error instanceof CloneSafetyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return handleApiError(new Error("Clone preview failed"), "Clone preview failed")
  }
}
