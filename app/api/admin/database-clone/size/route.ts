import { NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { cloneDatabaseSizes } from "@/lib/database-clone"
import { CloneSafetyError } from "@/lib/database-clone-policy"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    return NextResponse.json(await cloneDatabaseSizes(), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CloneSafetyError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } })
    return handleApiError(new Error("Database size could not be loaded"), "Database size could not be loaded")
  }
}
