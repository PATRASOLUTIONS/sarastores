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

    // Daily traffic (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyVisits = await visitsCol.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: "$date",
          visits: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray()

    // Daily registrations
    const dailyRegistrations = await participantsCol.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          registrations: { $sum: 1 },
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
      { $sort: { _id: 1 } }
    ]).toArray()

    // Merge data for daily graph
    const dateMap: Record<string, any> = {}

    dailyVisits.forEach((d: any) => {
      dateMap[d._id] = { date: d._id, visits: d.visits, registrations: 0, spins: 0, winners: 0 }
    })

    dailyRegistrations.forEach((d: any) => {
      if (dateMap[d._id]) {
        dateMap[d._id].registrations = d.registrations
        dateMap[d._id].spins = d.spins
        dateMap[d._id].winners = d.winners
      } else {
        dateMap[d._id] = {
          date: d._id,
          visits: 0,
          registrations: d.registrations,
          spins: d.spins,
          winners: d.winners
        }
      }
    })

    const dailyData = Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date))

    // Overall stats
    const totalVisits = await visitsCol.countDocuments()
    const totalRegistrations = await participantsCol.countDocuments()
    const totalSpins = await participantsCol.countDocuments({ hasSpun: true })

    // Drop-off rate: visitors who didn't register
    const dropOffRate = totalVisits > 0
      ? (((totalVisits - totalRegistrations) / totalVisits) * 100).toFixed(1)
      : "0.0"

    // Spin success rate: registrations that led to a spin
    const spinSuccessRate = totalRegistrations > 0
      ? ((totalSpins / totalRegistrations) * 100).toFixed(1)
      : "0.0"

    return NextResponse.json({
      dailyData,
      summary: {
        totalVisits,
        totalRegistrations,
        totalSpins,
        dropOffRate,
        spinSuccessRate
      }
    })
  } catch (error) {
    console.error("Analytics API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
