import { NextRequest, NextResponse } from "next/server"
import { getCampaignCollection, type SpinVisitStats, type SpinParticipantStats } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const campaignSlug = searchParams.get("campaignId") || "default"

    const visitsCol = await getCampaignCollection(campaignSlug, "visits")
    const participantsCol = await getCampaignCollection(campaignSlug, "participants")

    // Store visits
    const storeVisits = await visitsCol.aggregate<SpinVisitStats>([
      { $group: { _id: "$store", visits: { $sum: 1 } } },
      { $sort: { visits: -1 } }
    ]).toArray()

    // Store conversions (participants per store)
    const storeParticipants = await participantsCol.aggregate<SpinParticipantStats>([
      {
        $group: {
          _id: "$store",
          participants: { $sum: 1 },
          spins: { $sum: { $cond: ["$hasSpun", 1, 0] } },
          winners: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$hasSpun", true] },
                    { $ne: ["$prize", "BETTER LUCK NEXT TIME"] },
                    { $ne: ["$prize", null] }
                  ]
                },
                1, 0
              ]
            }
          }
        }
      },
      { $sort: { participants: -1 } }
    ]).toArray()

    // Merge data
    const visitMap: Record<string, number> = Object.create(null)
    storeVisits.forEach((s) => { visitMap[s._id] = s.visits })

    const participantMap: Record<string, SpinParticipantStats> = Object.create(null)
    storeParticipants.forEach((s) => { participantMap[s._id] = s })

    // Get all unique stores
    const allStores = new Set([
      ...storeVisits.map((s) => s._id),
      ...storeParticipants.map((s) => s._id)
    ])

    const stores = Array.from(allStores).map(store => ({
      store,
      visits: visitMap[store] || 0,
      participants: participantMap[store]?.participants || 0,
      spins: participantMap[store]?.spins || 0,
      winners: participantMap[store]?.winners || 0,
      conversionRate: visitMap[store]
        ? (((participantMap[store]?.participants || 0) / visitMap[store]) * 100).toFixed(1)
        : "0.0"
    }))

    // Sort by participants for leaderboard
    stores.sort((a, b) => b.participants - a.participants)

    // Pre-built store URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const spinBase = campaignSlug === "default" ? "/spin" : `/spin/${campaignSlug}`
    const storeUrls = stores.map((s, i) => ({
      ...s,
      rank: i + 1,
      url: `${baseUrl}${spinBase}?store=${encodeURIComponent(s.store)}`
    }))

    return NextResponse.json({
      stores: storeUrls,
      totalStores: stores.length
    })
  } catch (error) {
    console.error("Stores API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
