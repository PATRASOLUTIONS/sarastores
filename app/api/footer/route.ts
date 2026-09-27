import { NextResponse } from "next/server"
import { getFooterData, setFooterData } from "@/lib/db-service"

// GET: fetch footer data
export async function GET() {
  const data = await getFooterData()
  return NextResponse.json(data || {})
}

// POST: update footer data
export async function POST(req: Request) {
  const body = await req.json()
  const updated = await setFooterData(body)
  return NextResponse.json(updated)
}
