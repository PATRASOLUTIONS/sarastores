import { NextRequest, NextResponse } from "next/server"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"

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

    const couponCodesCol = await getCampaignCollection(campaignSlug, "couponCodes")

    const query: any = {}
    if (prizeName) query.prizeName = prizeName

    const codes = await couponCodesCol
      .find(query)
      .sort({ prizeName: 1, createdAt: -1 })
      .toArray()

    // Group by prize
    const grouped: Record<string, any[]> = {}
    codes.forEach((c: any) => {
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
    const body = await request.json()
    const { prizeName, codes, campaignId } = body
    const campaignSlug = campaignId || "default"

    if (!prizeName || !codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: "Prize name and an array of coupon codes are required" },
        { status: 400 }
      )
    }

    const collection = await getCampaignCollection(campaignSlug, "couponCodes")

    // Filter out duplicates
    const existingCodes = await collection.find({
      code: { $in: codes.map((c: string) => c.trim().toUpperCase()) }
    }).toArray()
    const existingSet = new Set(existingCodes.map((c: any) => c.code))

    const newCodes = codes
      .map((c: string) => c.trim().toUpperCase())
      .filter((c: string) => c.length > 0 && !existingSet.has(c))

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

    await collection.insertMany(docs)

    return NextResponse.json({
      success: true,
      added: newCodes.length,
      skipped: codes.length - newCodes.length,
      message: `Added ${newCodes.length} coupon codes for ${prizeName}`
    })
  } catch (error) {
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
