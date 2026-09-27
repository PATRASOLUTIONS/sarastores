import { NextResponse } from "next/server"
import { indianStates } from "@/lib/indiaData"

export async function GET() {
  try {
    return NextResponse.json({ states: indianStates })
  } catch (error) {
    console.error("Error fetching Indian states:", error)
    return NextResponse.json({ error: "Failed to fetch states" }, { status: 500 })
  }
}
