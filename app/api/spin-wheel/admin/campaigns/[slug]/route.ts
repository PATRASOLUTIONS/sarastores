import { NextRequest, NextResponse } from "next/server"
import { getCampaignsCollection, findCampaignBySlug, getCampaignCollection, type SpinCampaign } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0)

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

    const totalCoupons = couponStats.reduce((s: number, c) => s + c.total, 0)
    const usedCoupons = couponStats.reduce((s: number, c) => s + c.used, 0)

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
    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid campaign data" }, { status: 400 })
    const { name, description, isActive } = parsed.data

    const col = await getCampaignsCollection()
    const campaign = await findCampaignBySlug(slug)
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const updateFields: Partial<SpinCampaign> = { updatedAt: new Date() }
    if (name !== undefined) updateFields.name = name
    if (description !== undefined) updateFields.description = description
    if (isActive !== undefined) updateFields.isActive = isActive

    const updated = await col.updateOne({ slug }, { $set: updateFields })
    if (!updated.acknowledged) throw new Error("Campaign update was not acknowledged")
    if (updated.matchedCount !== 1) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    return NextResponse.json({ success: true, message: "Campaign updated" })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
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
    const { db } = await connectToDatabase()
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
      } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== 26) throw error
      }
    }

    // Delete campaign metadata
    const deleted = await col.deleteOne({ slug })
    if (!deleted.acknowledged || deleted.deletedCount !== 1) throw new Error("Campaign deletion was not completed")

    return NextResponse.json({ success: true, message: `Campaign "${campaign.name}" deleted` })
  } catch (error) {
    console.error("Campaign DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
