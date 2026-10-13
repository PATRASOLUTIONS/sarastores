import { NextRequest, NextResponse } from "next/server"
import { getCampaignsCollection, findCampaignBySlug, DEFAULT_PRIZES, getCampaignCollection, type SpinCampaign, type SpinPrize, type SpinCouponStats } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"
import type { Filter } from "mongodb"
import { z } from "zod"
import { connectToDatabase } from "@/lib/mongodb"

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(5000).optional(),
  cloneFrom: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
}).strict()

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
    const filter: Filter<SpinCampaign> = {}
    if (activeOnly) filter.isActive = true

    const campaigns = await col.find(filter).sort({ createdAt: -1 }).toArray()

    // Enrich with counts
    const enriched = await Promise.all(
      campaigns.map(async (c) => {
        const slug = c.slug
        const invCol = await getCampaignCollection(slug, "inventory")
        const partCol = await getCampaignCollection(slug, "participants")
        const couponCol = await getCampaignCollection(slug, "couponCodes")

        const [prizeCount, participantCount, couponStats] = await Promise.all([
          invCol.countDocuments(),
          partCol.countDocuments(),
          couponCol
            .aggregate<SpinCouponStats>([
              { $group: { _id: "$prizeName", total: { $sum: 1 }, used: { $sum: { $cond: ["$isUsed", 1, 0] } } } },
            ])
            .toArray(),
        ])

        const totalCoupons = couponStats.reduce((s: number, c) => s + c.total, 0)
        const usedCoupons = couponStats.reduce((s: number, c) => s + c.used, 0)

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
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid campaign data" }, { status: 400 })
    const { name, description, cloneFrom } = parsed.data

    let slug = generateSlug(name.trim())
    if (!slug) {
      return NextResponse.json({ error: "Invalid campaign name" }, { status: 400 })
    }

    // Ensure unique slug
    const existing = await findCampaignBySlug(slug)
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`
    }
    if (cloneFrom && !await findCampaignBySlug(cloneFrom)) {
      return NextResponse.json({ error: "Source campaign not found" }, { status: 404 })
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

    await col.createIndex({ slug: 1 }, { unique: true, name: "slug_unique" })
    const destInvCol = await getCampaignCollection<SpinPrize>(slug, "inventory")
    await destInvCol.createIndex({ prizeName: 1 }, { unique: true })
    const { client } = await connectToDatabase()
    const session = client.startSession()
    let insertedId: string | undefined
    try {
      insertedId = await session.withTransaction(async () => {
        const inserted = await col.insertOne(campaign, { session })
        if (!inserted.acknowledged) throw new Error("Campaign creation was not acknowledged")
        let prizes = DEFAULT_PRIZES.map(prize => ({ ...prize, distributed: 0 }))
        if (cloneFrom) {
          const srcInvCol = await getCampaignCollection<SpinPrize>(cloneFrom, "inventory")
          const source = await srcInvCol.find({}, { session }).toArray()
          if (source.length) prizes = source.map(({ _id, ...rest }) => ({ ...rest, distributed: 0 }))
        }
        const seeded = await destInvCol.insertMany(prizes, { session })
        if (!seeded.acknowledged || seeded.insertedCount !== prizes.length) throw new Error("Campaign prizes were not fully stored")
        return inserted.insertedId.toString()
      })
    } finally {
      await session.endSession()
    }
    if (!insertedId) throw new Error("Campaign creation did not complete")

    return NextResponse.json({
      success: true,
      campaign: {
        id: insertedId,
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
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      console.error("Campaign uniqueness conflict:", error)
      return NextResponse.json({ error: "Campaign name or stored inventory conflicts; reconcile before retrying" }, { status: 409 })
    }
    console.error("Campaigns POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
