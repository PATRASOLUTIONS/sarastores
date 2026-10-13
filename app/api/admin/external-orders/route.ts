import { type NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import type { ExternalFulfillmentRecord } from "@/lib/external-fulfillment"

export const dynamic = "force-dynamic"

/** Queue monitor for orders routed to the eXlr8/KGen fulfilment provider. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") ?? 20)
    const page = Number(url.searchParams.get("page") ?? 1)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger((page - 1) * limit)) {
      return NextResponse.json({ error: "Valid whole-number page and limit are required" }, { status: 400 })
    }
    const status = url.searchParams.get("status")

    const filter: Record<string, unknown> = {}
    if (status && status !== "all") filter.status = status

    const collection = await getCollection<ExternalFulfillmentRecord>("external_orders")
    const [docs, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ])

    const items = normalizeId(docs)

    return NextResponse.json({ success: true, items, total, page, limit })
  } catch (error) {
    console.error("[admin/external-orders][GET]", error)
    return NextResponse.json({ error: "Failed to load external orders" }, { status: 500 })
  }
}
