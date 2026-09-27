import { NextRequest, NextResponse } from "next/server"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"
import * as XLSX from "xlsx"

function formatISTDateTime(value: unknown): string {
  if (!value) return ""

  const date = value instanceof Date ? value : new Date(value as any)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata"
  })
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const campaignSlug = searchParams.get("campaignId") || "default"

    const participantsCol = await getCampaignCollection(campaignSlug, "participants")
    const couponsCol = await getCampaignCollection(campaignSlug, "coupons")
    const visitsCol = await getCampaignCollection(campaignSlug, "visits")
    const inventoryCol = await getCampaignCollection(campaignSlug, "inventory")

    // Participants data
    const participants = await participantsCol
      .find()
      .sort({ createdAt: -1 })
      .toArray()

    // Coupons data
    const coupons = await couponsCol
      .find()
      .sort({ createdAt: -1 })
      .toArray()

    // Store data
    const storeVisits = await visitsCol.aggregate([
      { $group: { _id: "$store", visits: { $sum: 1 } } },
      { $sort: { visits: -1 } }
    ]).toArray()

    const storeParticipants = await participantsCol.aggregate([
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
      }
    ]).toArray()

    // Inventory summary
    const inventory = await inventoryCol.find().toArray()

    // Prepare data for sheets
    const participantsData = participants.map((p: any) => ({
      Name: p.name || "",
      Phone: p.phone || "",
      Email: p.email || "",
      Store: p.store || "",
      "OTP Verified": p.otpVerified ? "Yes" : "No",
      "Has Spun": p.hasSpun ? "Yes" : "No",
      Prize: p.prize || "",
      "Coupon Code": p.couponCode || "",
      "Registration Date": formatISTDateTime(p.createdAt),
      "Spin Date": formatISTDateTime(p.spinDate)
    }))

    const couponsData = coupons.map((c: any) => ({
      "Coupon Code": c.couponCode || "",
      Prize: c.prize || "",
      "Participant Name": c.participantName || "",
      "Participant Phone": c.participantPhone || "",
      "Participant Email": c.participantEmail || "",
      Store: c.store || "",
      Status: c.status || "",
      Date: formatISTDateTime(c.createdAt)
    }))

    // Build stores data
    const participantMap: Record<string, any> = {}
    storeParticipants.forEach((s: any) => { participantMap[s._id] = s })
    const visitMap: Record<string, number> = {}
    storeVisits.forEach((s: any) => { visitMap[s._id] = s.visits })
    const allStores = new Set([
      ...storeVisits.map((s: any) => s._id),
      ...storeParticipants.map((s: any) => s._id)
    ])

    const storesData = Array.from(allStores).map(store => {
      const visits = visitMap[store] || 0
      const parts = participantMap[store]?.participants || 0
      const spins = participantMap[store]?.spins || 0
      const winners = participantMap[store]?.winners || 0
      const conv = visits > 0 ? ((parts / visits) * 100).toFixed(1) : "0.0"
      return {
        Store: store,
        Visits: visits,
        Participants: parts,
        Spins: spins,
        Winners: winners,
        "Conversion Rate": `${conv}%`
      }
    })

    const prizeSummaryData = inventory.map((item: any) => ({
      Prize: item.prizeName || "",
      Total: item.total || 0,
      Distributed: item.distributed || 0,
      Remaining: (item.total || 0) - (item.distributed || 0),
      Active: item.isActive !== false ? "Yes" : "No"
    }))

    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new()
    
    if (participantsData.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(participantsData)
      XLSX.utils.book_append_sheet(workbook, ws1, "Participants")
    }
    
    if (couponsData.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(couponsData)
      XLSX.utils.book_append_sheet(workbook, ws2, "Coupons")
    }
    
    if (storesData.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(storesData)
      XLSX.utils.book_append_sheet(workbook, ws3, "Stores")
    }
    
    if (prizeSummaryData.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(prizeSummaryData)
      XLSX.utils.book_append_sheet(workbook, ws4, "Prize Summary")
    }

    if (workbook.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Message: "No data available yet" }]), "Summary")
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })
    const fileName = `Spin-Wheel-Report-${new Date().toISOString().split("T")[0]}.xlsx`

    // Return as buffer directly
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    })
  } catch (error) {
    console.error("Export API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
