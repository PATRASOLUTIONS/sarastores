import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId, type Filter } from "mongodb"
import { getCampaignCollection, DEFAULT_PRIZES, type SpinPrize, type SpinCouponStats } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"
import { SpinPrizeCreateSchema, SpinPrizeUpdateSchema } from "@/lib/validation"

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const campaignSlug = searchParams.get("campaignId") || "default"

    const collection = await getCampaignCollection<SpinPrize>(campaignSlug, "inventory")
    const couponCodesCol = await getCampaignCollection(campaignSlug, "couponCodes")

    // Initialize if empty
    const count = await collection.countDocuments()
    if (count === 0) {
      await collection.insertMany(DEFAULT_PRIZES)
      await collection.createIndex({ prizeName: 1 }, { unique: true })
    }

    const inventory = await collection.find().toArray()

    // Get coupon stats per prize
    const couponStats = await couponCodesCol.aggregate<SpinCouponStats>([
      {
        $group: {
          _id: "$prizeName",
          total: { $sum: 1 },
          used: { $sum: { $cond: ["$isUsed", 1, 0] } },
          unused: { $sum: { $cond: ["$isUsed", 0, 1] } }
        }
      }
    ]).toArray()

    const couponMap: Record<string, SpinCouponStats> = Object.create(null)
    couponStats.forEach((s) => { couponMap[s._id] = s })

    return NextResponse.json({
      inventory: inventory.map((item) => ({
        id: item._id.toString(),
        prizeName: item.prizeName,
        emoji: item.emoji || "🎁",
        productImage: item.productImage || "",
        total: item.total,
        distributed: item.distributed || 0,
        remaining: item.total - (item.distributed || 0),
        exhausted: (item.distributed || 0) >= item.total,
        isActive: item.isActive !== false,
        dateRanges: item.dateRanges || [],
        timeSlots: item.timeSlots || [],
        weightMultiplier: item.weightMultiplier || 1,
        couponStats: {
          total: couponMap[item.prizeName]?.total || 0,
          used: couponMap[item.prizeName]?.used || 0,
          unused: couponMap[item.prizeName]?.unused || 0
        }
      }))
    })
  } catch (error) {
    console.error("Inventory GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = SpinPrizeUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid prize data" }, { status: 400 })
    const { prizeName, campaignId, ...updateFields } = parsed.data
    const campaignSlug = campaignId || new URL(request.url).searchParams.get("campaignId") || "default"

    const collection = await getCampaignCollection<SpinPrize>(campaignSlug, "inventory")
    const query: Filter<SpinPrize> = { prizeName }
    if (updateFields.total !== undefined) {
      query.$expr = { $lte: [{ $ifNull: ["$distributed", 0] }, updateFields.total] }
    }
    const updated = await collection.findOneAndUpdate(query, { $set: updateFields }, { returnDocument: "after" })
    if (!updated) {
      const existing = await collection.findOne({ prizeName })
      return NextResponse.json({ error: existing ? "Total cannot be below the current distributed count" : "Prize not found" },
        { status: existing ? 409 : 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${prizeName}`
    })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    console.error("Inventory PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = SpinPrizeCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid prize data" }, { status: 400 })
    const { prizeName, emoji, productImage, total, isActive, dateRanges, timeSlots, weightMultiplier, campaignId } = parsed.data
    const campaignSlug = campaignId || new URL(request.url).searchParams.get("campaignId") || "default"

    if (!prizeName) {
      return NextResponse.json({ error: "Prize name is required" }, { status: 400 })
    }

    const collection = await getCampaignCollection<SpinPrize>(campaignSlug, "inventory")

    const existing = await collection.findOne({ prizeName })
    if (existing) {
      return NextResponse.json({ error: "Prize already exists" }, { status: 409 })
    }
    await collection.createIndex({ prizeName: 1 }, { unique: true })

    const inserted = await collection.insertOne({
      prizeName,
      emoji: emoji || "🎁",
      productImage: productImage || "",
      total,
      distributed: 0,
      isActive: isActive ?? true,
      dateRanges: dateRanges || [],
      timeSlots: timeSlots || [],
      weightMultiplier: weightMultiplier ?? 1
    })
    if (!inserted.acknowledged) throw new Error("Prize creation was not acknowledged")

    return NextResponse.json({ success: true, message: `Created prize: ${prizeName}` })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "Prize already exists" }, { status: 409 })
    }
    console.error("Inventory POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const prizeName = searchParams.get("prizeName")
    const campaignSlug = searchParams.get("campaignId") || "default"

    if (!id && !prizeName) {
      return NextResponse.json({ error: "Prize ID or name is required" }, { status: 400 })
    }

    if (id && !ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid prize ID" }, { status: 400 })
    const collection = await getCampaignCollection<SpinPrize>(campaignSlug, "inventory")

    let query: Filter<SpinPrize> = {}
    if (id) {
      query = { _id: new ObjectId(id) }
    } else if (prizeName) {
      query = { prizeName: prizeName }
    }

    const { client } = await connectToDatabase()
    const session = client.startSession()
    let prize: string | undefined
    try {
      prize = await session.withTransaction(async () => {
        const current = await collection.findOne(query, { session })
        if (!current) return undefined
        const couponCodesCol = await getCampaignCollection(campaignSlug, "couponCodes")
        const couponsDeleted = await couponCodesCol.deleteMany({ prizeName: current.prizeName }, { session })
        if (!couponsDeleted.acknowledged) throw new Error("Coupon deletion was not acknowledged")
        const deleted = await collection.deleteOne({ _id: current._id }, { session })
        if (!deleted.acknowledged || deleted.deletedCount !== 1) throw new Error("Prize deletion was not completed")
        return current.prizeName
      })
    } finally {
      await session.endSession()
    }
    if (!prize) return NextResponse.json({ error: "Prize not found" }, { status: 404 })

    return NextResponse.json({ success: true, message: `Deleted prize: ${prize}` })
  } catch (error) {
    console.error("Inventory DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
