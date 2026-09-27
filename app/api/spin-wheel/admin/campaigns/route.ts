import { NextRequest, NextResponse } from "next/server"
import { getCampaignsCollection, findCampaignBySlug, seedCampaignPrizes, getCampaignCollection } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

/** GET — list all campaigns (optionally filter by ?active=true) */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("active") === "true"

    const col = await getCampaignsCollection()
    const filter: Record<string, any> = {}
    if (activeOnly) filter.isActive = true

    const campaigns = await col.find(filter).sort({ createdAt: -1 }).toArray()

    // Enrich with counts
    const enriched = await Promise.all(
      campaigns.map(async (c: any) => {
        const slug = c.slug
        const invCol = await getCampaignCollection(slug, "inventory")
        const partCol = await getCampaignCollection(slug, "participants")
        const couponCol = await getCampaignCollection(slug, "couponCodes")

        const [prizeCount, participantCount, couponStats] = await Promise.all([
          invCol.countDocuments(),
          partCol.countDocuments(),
          couponCol
            .aggregate([
              { $group: { _id: "$prizeName", total: { $sum: 1 }, used: { $sum: { $cond: ["$isUsed", 1, 0] } } } },
            ])
            .toArray(),
        ])

        const totalCoupons = couponStats.reduce((s: number, c: any) => s + c.total, 0)
        const usedCoupons = couponStats.reduce((s: number, c: any) => s + c.used, 0)

        return {
          id: c._id.toString(),
          name: c.name,
          slug: c.slug,
          description: c.description || "",
          isActive: c.isActive,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          stats: {
            prizes: prizeCount,
            participants: participantCount,
            totalCoupons,
            usedCoupons,
            unusedCoupons: totalCoupons - usedCoupons,
          },
        }
      })
    )

    return NextResponse.json({ campaigns: enriched })
  } catch (error) {
    console.error("Campaigns GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST — create a new campaign (clones default prizes + coupon codes if requested) */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const { name, description, cloneFrom } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    let slug = generateSlug(name.trim())
    if (!slug) {
      return NextResponse.json({ error: "Invalid campaign name" }, { status: 400 })
    }

    // Ensure unique slug
    const existing = await findCampaignBySlug(slug)
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    const col = await getCampaignsCollection()
    const now = new Date()
    const campaign = {
      name: name.trim(),
      slug,
      description: description || "",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }

    await col.insertOne(campaign)

    // Seed default prizes
    await seedCampaignPrizes(slug)

    // If cloneFrom is provided, copy ONLY prize inventory from another campaign
    // No participant, visit, OTP, or coupon code data is carried over
    if (cloneFrom && typeof cloneFrom === "string") {
      const srcInvCol = await getCampaignCollection(cloneFrom, "inventory")
      const destInvCol = await getCampaignCollection(slug, "inventory")

      // Clone prizes (overwrite defaults)
      const srcPrizes = await srcInvCol.find().toArray()
      if (srcPrizes.length > 0) {
        await destInvCol.deleteMany({})
        const cloned = srcPrizes.map(({ _id, ...rest }: any) => ({ ...rest, distributed: 0 }))
        await destInvCol.insertMany(cloned)
        await destInvCol.createIndex({ prizeName: 1 }, { unique: true })
      }
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: (campaign as any)._id?.toString() || "",
        name: campaign.name,
        slug: campaign.slug,
        description: campaign.description,
        isActive: campaign.isActive,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        url: `/spin/${slug}`,
      },
      message: `Campaign "${name}" created with slug: ${slug}`,
    })
  } catch (error) {
    console.error("Campaigns POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
