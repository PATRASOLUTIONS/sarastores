import { NextResponse } from "next/server"
import { getFooterData, setFooterData } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

// GET: fetch footer data
export async function GET() {
  const data = await getFooterData()
  return NextResponse.json(data || {})
}

// POST: update footer data
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const body = await req.json()
  const updated = await setFooterData(body)
  return NextResponse.json(updated)
}
