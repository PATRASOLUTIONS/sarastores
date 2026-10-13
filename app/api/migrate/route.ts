import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  return NextResponse.json({ error: "Legacy localStorage migration is not supported. No data was imported." }, { status: 410 })
}
