import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCampaignCollection, resolveCampaignSlug } from "@/lib/spin-wheel-campaigns"
import { withRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const trackSchema = z.object({
  store: z.string().trim().max(120).optional(),
  campaignId: z.string().trim().max(60).optional(),
})

/**
 * Campaign visit counter. Public by design — it runs before the visitor
 * identifies themselves — so the budget is what bounds how many documents a
 * caller can write.
 */
export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const parsed = trackSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: true })

    // The slug becomes part of a collection name, so anything that is not a
    // plain slug is refused rather than coerced to the default campaign.
    const campaignSlug = resolveCampaignSlug(parsed.data.campaignId)
    if (!campaignSlug) return NextResponse.json({ success: true })

    const visitsCol = await getCampaignCollection(campaignSlug, "visits")

    await visitsCol.insertOne({
      store: parsed.data.store || "direct",
      timestamp: new Date(),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) || "unknown",
      date: new Date().toISOString().split("T")[0] // YYYY-MM-DD for daily grouping
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Track visit error:", error)
    return NextResponse.json({ success: true }) // Tracking never fails the page
  }
}, { windowMs: 60 * 1000, maxRequests: 60, message: "Too many requests." })
