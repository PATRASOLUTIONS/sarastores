import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { getCampaignCollection, DEFAULT_PRIZES } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const campaignSlug = searchParams.get("campaignId") || "default"

    const collection = await getCampaignCollection(campaignSlug, "inventory")
    const couponCodesCol = await getCampaignCollection(campaignSlug, "couponCodes")

    // Initialize if empty
    const count = await collection.countDocuments()
    if (count === 0) {
      await collection.insertMany(DEFAULT_PRIZES)
      await collection.createIndex({ prizeName: 1 }, { unique: true })
    }

    const inventory = await collection.find().toArray()

    // Get coupon stats per prize
    const couponStats = await couponCodesCol.aggregate([
      {
        $group: {
          _id: "$prizeName",
          total: { $sum: 1 },
          used: { $sum: { $cond: ["$isUsed", 1, 0] } },
          unused: { $sum: { $cond: ["$isUsed", 0, 1] } }
        }
      }
    ]).toArray()

    const couponMap: Record<string, any> = {}
    couponStats.forEach((s: any) => { couponMap[s._id] = s })

    return NextResponse.json({
      inventory: inventory.map((item: any) => ({
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
    const body = await request.json()
    const { prizeName, total, isActive, dateRanges, timeSlots, emoji, productImage, weightMultiplier, campaignId } = body
    const campaignSlug = campaignId || "default"

    if (!prizeName) {
      return NextResponse.json(
        { error: "Prize name is required" },
        { status: 400 }
      )
    }

    const collection = await getCampaignCollection(campaignSlug, "inventory")

    const updateFields: any = {}

    if (total !== undefined) {
      if (total < 0) {
        return NextResponse.json({ error: "Total must be >= 0" }, { status: 400 })
      }
      const current = await collection.findOne({ prizeName })
      if (current && total < (current.distributed || 0)) {
        return NextResponse.json(
          { error: `Cannot set total below distributed count (${current.distributed})` },
          { status: 400 }
        )
      }
      updateFields.total = parseInt(total)
    }

    if (isActive !== undefined) updateFields.isActive = Boolean(isActive)
    if (dateRanges !== undefined) updateFields.dateRanges = dateRanges
    if (timeSlots !== undefined) updateFields.timeSlots = timeSlots
    if (emoji !== undefined) updateFields.emoji = emoji
    if (productImage !== undefined) updateFields.productImage = productImage
    if (weightMultiplier !== undefined) updateFields.weightMultiplier = Number(weightMultiplier) || 1

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    await collection.updateOne(
      { prizeName },
      { $set: updateFields },
      { upsert: true }
    )

    return NextResponse.json({
      success: true,
      message: `Updated ${prizeName}`
    })
  } catch (error) {
    console.error("Inventory PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const { prizeName, emoji, productImage, total, dateRanges, timeSlots, weightMultiplier, campaignId } = body
    const campaignSlug = campaignId || "default"

    if (!prizeName) {
      return NextResponse.json({ error: "Prize name is required" }, { status: 400 })
    }

    const collection = await getCampaignCollection(campaignSlug, "inventory")

    const existing = await collection.findOne({ prizeName })
    if (existing) {
      return NextResponse.json({ error: "Prize already exists" }, { status: 409 })
    }

    await collection.insertOne({
      prizeName,
      emoji: emoji || "🎁",
      productImage: productImage || "",
      total: parseInt(total) || 0,
      distributed: 0,
      isActive: true,
      dateRanges: dateRanges || [],
      timeSlots: timeSlots || [],
      weightMultiplier: Number(weightMultiplier) || 1
    })

    return NextResponse.json({ success: true, message: `Created prize: ${prizeName}` })
  } catch (error) {
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

    const collection = await getCampaignCollection(campaignSlug, "inventory")

    let query: any = {}
    if (id) {
      query = { _id: new ObjectId(id) }
    } else if (prizeName) {
      query = { prizeName: prizeName }
    }

    const prize = await collection.findOne(query)
    if (!prize) {
      return NextResponse.json({ error: "Prize not found" }, { status: 404 })
    }

    // Also delete associated coupon codes
    const couponCodesCol = await getCampaignCollection(campaignSlug, "couponCodes")
    await couponCodesCol.deleteMany({ prizeName: prize.prizeName })

    await collection.deleteOne(query)

    return NextResponse.json({ success: true, message: `Deleted prize: ${prize.prizeName}` })
  } catch (error) {
    console.error("Inventory DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
