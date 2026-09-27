import { NextResponse } from "next/server"
import { indianCities } from "@/lib/indiaData"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const state = searchParams.get("state")

    if (!state) {
      return NextResponse.json({ error: "State parameter is required" }, { status: 400 })
    }

    const cities = indianCities[state] || []
    return NextResponse.json({ cities })
  } catch (error) {
    console.error("Error fetching Indian cities:", error)
    return NextResponse.json({ error: "Failed to fetch cities" }, { status: 500 })
  }
}
