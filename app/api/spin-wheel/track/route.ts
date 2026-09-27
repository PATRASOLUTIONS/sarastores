import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store, campaignId } = body
    const campaignSlug = campaignId || "default"

    const visitsCol = await getCampaignCollection(campaignSlug, "visits")

    await visitsCol.insertOne({
      store: store || "direct",
      timestamp: new Date(),
      userAgent: request.headers.get("user-agent") || "unknown",
      date: new Date().toISOString().split("T")[0] // YYYY-MM-DD for daily grouping
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Track visit error:", error)
    return NextResponse.json({ success: true }) // Don't fail tracking silently
  }
}
