import { NextRequest, NextResponse } from "next/server"
import { findCampaignBySlug, getCampaignCollection } from "@/lib/spin-wheel-campaigns"
import { SpinPrizeListResponseSchema } from "@/lib/validation"
import { handleApiError } from "@/lib/api-error"

interface PublicPrize {
  prizeName: string
  emoji?: string | null
  productImage?: string | null
  isActive?: boolean
}

// Intentionally public and read-only: no coupon codes, counts, weights or seeding.
export async function GET(request: NextRequest) {
  const campaign = request.nextUrl.searchParams.get("campaignId") || "default"
  if (!/^[a-z0-9-]{1,60}$/.test(campaign)) return NextResponse.json({ error: "Invalid campaign" }, { status: 400 })
  try {
    const metadata = await findCampaignBySlug(campaign)
    if ((!metadata && campaign !== "default") || metadata?.isActive === false) {
      return NextResponse.json({ error: "Campaign not found or inactive" }, { status: 404 })
    }
    const collection = await getCampaignCollection<PublicPrize>(campaign, "inventory")
    const inventory = await collection.find({ isActive: { $ne: false } }, {
      projection: { _id: 0, prizeName: 1, emoji: 1, productImage: 1, isActive: 1 },
    }).toArray()
    return NextResponse.json(SpinPrizeListResponseSchema.parse({ inventory }), {
      headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
    })
  } catch (error) {
    return handleApiError(error, "Failed to load campaign prizes")
  }
}
