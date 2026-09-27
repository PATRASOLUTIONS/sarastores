import { NextRequest, NextResponse } from "next/server"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const prize = searchParams.get("prize") || ""
    const store = searchParams.get("store") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const campaignSlug = searchParams.get("campaignId") || "default"

    const participantsCol = await getCampaignCollection(campaignSlug, "participants")

    const query: any = {}

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    }

    if (prize) {
      query.prize = prize
    }

    if (store) {
      query.store = store
    }

    const total = await participantsCol.countDocuments(query)
    const participants = await participantsCol
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    return NextResponse.json({
      participants: participants.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        phone: p.phone,
        email: p.email,
        otpCode: p.otpCode || p.otp || null,
        otpVerified: !!p.otpVerified,
        prize: p.prize,
        couponCode: p.couponCode,
        store: p.store,
        hasSpun: p.hasSpun,
        createdAt: p.createdAt,
        spinDate: p.spinDate
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error("Participants API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
