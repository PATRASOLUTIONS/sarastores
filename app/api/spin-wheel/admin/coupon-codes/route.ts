import { NextRequest, NextResponse } from "next/server"
import { getCampaignCollection, type SpinCouponCode } from "@/lib/spin-wheel-campaigns"
import type { Filter } from "mongodb"
import { requireAdmin } from "@/lib/auth"
import { z } from "zod"
import { connectToDatabase } from "@/lib/mongodb"

const uploadSchema = z.object({
  prizeName: z.string().trim().min(1).max(150),
  codes: z.array(z.string().trim().min(1).max(500)).min(1).max(10000),
  campaignId: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
}).strict()

// GET: List all coupon codes for a specific prize
// POST: Add coupon codes to a specific prize
// DELETE: Remove a specific coupon code
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const prizeName = searchParams.get("prizeName") || ""
    const campaignSlug = searchParams.get("campaignId") || "default"

    const couponCodesCol = await getCampaignCollection<SpinCouponCode>(campaignSlug, "couponCodes")

    const query: Filter<SpinCouponCode> = {}
    if (prizeName) query.prizeName = prizeName

    const codes = await couponCodesCol
      .find(query)
      .sort({ prizeName: 1, createdAt: -1 })
      .toArray()

    // Group by prize
    const grouped: Record<string, Array<Omit<SpinCouponCode, "isUsed" | "usedBy"> & { id: string; isUsed: boolean; usedBy: string | null }>> = Object.create(null)
    codes.forEach((c) => {
      if (!grouped[c.prizeName]) grouped[c.prizeName] = []
      grouped[c.prizeName].push({
        id: c._id.toString(),
        code: c.code,
        prizeName: c.prizeName,
        isUsed: c.isUsed || false,
        usedBy: c.usedBy || null,
        createdAt: c.createdAt,
      })
    })

    return NextResponse.json({ couponCodes: grouped })
  } catch (error) {
    console.error("Coupon codes GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = uploadSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid coupon-code upload" }, { status: 400 })
    const { prizeName, codes, campaignId } = parsed.data
    const campaignSlug = campaignId || new URL(request.url).searchParams.get("campaignId") || "default"
    const collection = await getCampaignCollection<SpinCouponCode>(campaignSlug, "couponCodes")
    await collection.createIndex({ code: 1 }, { unique: true, name: "code_unique" })

    // Filter out duplicates
    const existingCodes = await collection.find({
      code: { $in: codes.map(c => c.toUpperCase()) }
    }).toArray()
    const existingSet = new Set(existingCodes.map((c) => c.code))

    const newCodes = [...new Set(codes.map(c => c.toUpperCase()))].filter(c => !existingSet.has(c))

    if (newCodes.length === 0) {
      return NextResponse.json(
        { error: "All coupon codes already exist", added: 0 },
        { status: 400 }
      )
    }

    const docs = newCodes.map((code: string) => ({
      code,
      prizeName,
      isUsed: false,
      usedBy: null,
      createdAt: new Date()
    }))

    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        const inserted = await collection.insertMany(docs, { session })
        if (!inserted.acknowledged || inserted.insertedCount !== docs.length) throw new Error("Coupon-code upload was not fully acknowledged")
      })
    } finally {
      await session.endSession()
    }

    return NextResponse.json({
      success: true,
      added: newCodes.length,
      skipped: codes.length - newCodes.length,
      message: `Added ${newCodes.length} coupon codes for ${prizeName}`
    })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    console.error("Coupon codes POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const campaignSlug = searchParams.get("campaignId") || "default"

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    const couponCodesCol = await getCampaignCollection(campaignSlug, "couponCodes")
    const result = await couponCodesCol.deleteOne({
      code: code.toUpperCase(),
      isUsed: false // Only allow deleting unused codes
    })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Code not found or already used" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Coupon codes DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
