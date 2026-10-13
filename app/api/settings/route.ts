import { NextResponse } from "next/server"
import { getSettingsData, setSettingsData } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { StoreSettingsSchema } from "@/lib/validation"
import { handleApiError } from "@/lib/api-error"

// GET: fetch settings data
export async function GET() {
  try {
    const data = await getSettingsData()
    return NextResponse.json(data || {})
  } catch (error) {
    return handleApiError(error, "Failed to load settings")
  }
}

// POST: update settings data
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = StoreSettingsSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid settings", details: parsed.error.flatten() }, { status: 400 })
    const updated = await setSettingsData(parsed.data)
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, "Failed to save settings")
  }
}
