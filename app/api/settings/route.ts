import { NextResponse } from "next/server"
import { getSettingsData, setSettingsData } from "@/lib/db-service"

// GET: fetch settings data
export async function GET() {
  const data = await getSettingsData()
  return NextResponse.json(data || {})
}

// POST: update settings data
export async function POST(req: Request) {
  const body = await req.json()
  const updated = await setSettingsData(body)
  return NextResponse.json(updated)
}
