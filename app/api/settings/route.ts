import { NextResponse } from "next/server"
import { getSettingsData, setSettingsData } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

// GET: fetch settings data
export async function GET() {
  const data = await getSettingsData()
  return NextResponse.json(data || {})
}

// POST: update settings data
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await req.json()
  const updated = await setSettingsData(body)
  return NextResponse.json(updated)
}
