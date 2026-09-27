import { NextRequest, NextResponse } from "next/server"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const campaignSlug = searchParams.get("campaignId") || "default"

    const visitsCol = await getCampaignCollection(campaignSlug, "visits")
    const participantsCol = await getCampaignCollection(campaignSlug, "participants")

    // Total visitors
    const totalVisitors = await visitsCol.countDocuments()

    // Total participants
    const totalParticipants = await participantsCol.countDocuments()

    // Total who spun
    const totalSpins = await participantsCol.countDocuments({ hasSpun: true })

    // OTP verified users
    const otpVerifiedCount = await participantsCol.countDocuments({ otpVerified: true })

    // Conversion rate
    const conversionRate = totalVisitors > 0
      ? ((totalParticipants / totalVisitors) * 100).toFixed(1)
      : "0.0"

    // Prize distribution
    const prizeDistribution = await participantsCol.aggregate([
      { $match: { hasSpun: true, prize: { $ne: null } } },
      { $group: { _id: "$prize", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray()

    // Store-wise performance
    const storePerformance = await participantsCol.aggregate([
      {
        $group: {
          _id: "$store",
          participants: { $sum: 1 },
          spins: { $sum: { $cond: ["$hasSpun", 1, 0] } },
          winners: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$hasSpun", true] }, { $ne: ["$prize", "BETTER LUCK NEXT TIME"] }, { $ne: ["$prize", null] }] },
                1, 0
              ]
            }
          }
        }
      },
      { $sort: { participants: -1 } }
    ]).toArray()

    // Add visit counts to store performance
    const storeVisits = await visitsCol.aggregate([
      { $group: { _id: "$store", visits: { $sum: 1 } } }
    ]).toArray()

    const visitMap: Record<string, number> = {}
    storeVisits.forEach((s: any) => { visitMap[s._id] = s.visits })

    const storePerformanceWithVisits = storePerformance.map((s: any) => ({
      store: s._id,
      visits: visitMap[s._id] || 0,
      participants: s.participants,
      spins: s.spins,
      winners: s.winners,
      conversionRate: visitMap[s._id]
        ? ((s.participants / visitMap[s._id]) * 100).toFixed(1)
        : "0.0"
    }))

    // Recent participants (last 5)
    const recentParticipants = await participantsCol
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray()

    return NextResponse.json({
      totalVisitors,
      totalParticipants,
      totalSpins,
      otpVerifiedCount,
      conversionRate,
      prizeDistribution: prizeDistribution.map((p: any) => ({
        prize: p._id,
        count: p.count
      })),
      storePerformance: storePerformanceWithVisits,
      recentParticipants: recentParticipants.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        phone: p.phone,
        email: p.email,
        prize: p.prize,
        store: p.store,
        date: p.createdAt,
        otpCode: p.otpCode || p.otp || null,
        otpVerified: !!p.otpVerified,
      }))
    })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
