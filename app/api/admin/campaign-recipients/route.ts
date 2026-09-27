import { type NextRequest, NextResponse } from "next/server"
import { checkAdminAuthorization } from "@/lib/auth"
import { buildAudience, countBySegment, filterBySegment } from "@/lib/marketing/segments"

export const dynamic = "force-dynamic"

/**
 * Campaign audience. Every recipient carries all the segments they belong to, so
 * the picker can show a customer as "champion + platinum + TV buyer" at once
 * rather than forcing them into a single bucket.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ message: auth.error || "Admin access required" }, { status: 401 })
    }

    const url = request.nextUrl
    const segment = url.searchParams.get("segment") || "all"
    const search = (url.searchParams.get("search") || "").trim().toLowerCase()
    const channel = url.searchParams.get("channel") || ""
    const limitParam = Number(url.searchParams.get("limit"))
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 5000) : 500

    const all = await buildAudience()
    let items = filterBySegment(all, segment)

    if (channel === "email") items = items.filter((r) => !!r.email && r.consent.email)
    if (channel === "whatsapp") items = items.filter((r) => !!r.phone && r.consent.whatsapp)

    if (search) {
      items = items.filter(
        (r) =>
          r.email.toLowerCase().includes(search) ||
          r.name.toLowerCase().includes(search) ||
          r.phone.includes(search),
      )
    }

    return NextResponse.json({
      items: items.slice(0, limit),
      total: items.length,
      counts: countBySegment(all),
    })
  } catch (error) {
    console.error("Error fetching campaign recipients:", error)
    return NextResponse.json({ message: "Failed to fetch recipients" }, { status: 500 })
  }
}
