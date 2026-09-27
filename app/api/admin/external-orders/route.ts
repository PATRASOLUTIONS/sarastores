import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** Queue monitor for orders routed to the eXlr8/KGen fulfilment provider. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100)
    const page = Math.max(Number(url.searchParams.get("page")) || 1, 1)
    const status = url.searchParams.get("status")

    const filter: Record<string, unknown> = {}
    if (status && status !== "all") filter.status = status

    const collection = await getCollection("external_orders")
    const [docs, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ])

    const items = docs.map((d: any) => ({ ...d, id: d._id?.toString?.() ?? d._id }))

    return NextResponse.json({ success: true, items, total, page, limit })
  } catch (error) {
    console.error("[admin/external-orders][GET]", error)
    return NextResponse.json({ error: "Failed to load external orders" }, { status: 500 })
  }
}
