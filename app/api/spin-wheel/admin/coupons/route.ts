import { NextRequest, NextResponse } from "next/server"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const prize = searchParams.get("prize") || ""
    const status = searchParams.get("status") || ""
    const exportCsv = searchParams.get("export") === "csv"
    const campaignSlug = searchParams.get("campaignId") || "default"

    const couponsCol = await getCampaignCollection(campaignSlug, "coupons")

    const query: any = {}
    if (prize) query.prize = prize
    if (status) query.status = status

    const coupons = await couponsCol
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    if (exportCsv) {
      // Generate CSV
      const headers = "Coupon Code,Prize,Participant Name,Phone,Email,Store,Status,Date\n"
      const rows = coupons.map((c: any) =>
        `${c.couponCode},${c.prize},"${c.participantName}",${c.participantPhone},${c.participantEmail},${c.store},${c.status},${new Date(c.createdAt).toLocaleDateString()}`
      ).join("\n")
      const csv = headers + rows

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=spin-wheel-coupons.csv"
        }
      })
    }

    return NextResponse.json({
      coupons: coupons.map((c: any) => ({
        id: c._id.toString(),
        couponCode: c.couponCode,
        prize: c.prize,
        participantName: c.participantName,
        participantPhone: c.participantPhone,
        participantEmail: c.participantEmail,
        store: c.store,
        status: c.status,
        createdAt: c.createdAt
      })),
      total: coupons.length
    })
  } catch (error) {
    console.error("Coupons API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
