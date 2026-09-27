import { NextRequest, NextResponse } from "next/server"
import { getCampaignsCollection, findCampaignBySlug, getCampaignCollection } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"

/** GET — fetch a single campaign by slug */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { slug } = await params
    const campaign = await findCampaignBySlug(slug)
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

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

    return NextResponse.json({
      id: campaign._id.toString(),
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description || "",
      isActive: campaign.isActive,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      stats: {
        prizes: prizeCount,
        participants: participantCount,
        totalCoupons,
        usedCoupons,
        unusedCoupons: totalCoupons - usedCoupons,
      },
    })
  } catch (error) {
    console.error("Campaign GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** PUT — update campaign metadata */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { slug } = await params
    const body = await request.json()
    const { name, description, isActive } = body

    const col = await getCampaignsCollection()
    const campaign = await findCampaignBySlug(slug)
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const updateFields: Record<string, any> = { updatedAt: new Date() }
    if (name !== undefined) updateFields.name = name
    if (description !== undefined) updateFields.description = description
    if (isActive !== undefined) updateFields.isActive = isActive

    await col.updateOne({ slug }, { $set: updateFields })

    return NextResponse.json({ success: true, message: "Campaign updated" })
  } catch (error) {
    console.error("Campaign PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — delete campaign and all its collections */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { slug } = await params

    if (slug === "default") {
      return NextResponse.json({ error: "Cannot delete the default campaign" }, { status: 400 })
    }

    const col = await getCampaignsCollection()
    const campaign = await findCampaignBySlug(slug)
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Drop all prefixed collections
    const { db } = await require("@/lib/mongodb").connectToDatabase()
    const collectionsToDrop = [
      `spin_${slug}_participants`,
      `spin_${slug}_inventory`,
      `spin_${slug}_couponCodes`,
      `spin_${slug}_coupons`,
      `spin_${slug}_otps`,
      `spin_${slug}_visits`,
    ]

    for (const collName of collectionsToDrop) {
      try {
        await db.dropCollection(collName)
      } catch {
        // collection might not exist
      }
    }

    // Delete campaign metadata
    await col.deleteOne({ slug })

    return NextResponse.json({ success: true, message: `Campaign "${campaign.name}" deleted` })
  } catch (error) {
    console.error("Campaign DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
