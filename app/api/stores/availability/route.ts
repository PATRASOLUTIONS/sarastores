import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { itemCodesFor, storeFarDistanceKm, storesHoldingStock } from "@/lib/store-stock"

export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "no-store" }
const MAX_ITEMS = 20

/**
 * Which stores can serve the cart from their own stock, for the checkout
 * pickup and pay-at-store pickers. `items` is `productId:quantity` pairs,
 * comma separated. Software is skipped because stores do not hold it.
 */
export async function GET(request: NextRequest) {
  try {
    const limit = await checkRateLimit(request, RATE_LIMITS.API)
    if (!limit.success) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers })

    const pairs = (new URL(request.url).searchParams.get("items") || "").split(",").filter(Boolean)
    if (pairs.length === 0 || pairs.length > MAX_ITEMS) {
      return NextResponse.json({ error: `Send between 1 and ${MAX_ITEMS} items` }, { status: 400, headers })
    }
    const items: { id: string; quantity: number }[] = []
    for (const pair of pairs) {
      const [id, quantity] = pair.split(":")
      const amount = Number(quantity ?? 1)
      if (!id || id.length > 100 || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000) {
        return NextResponse.json({ error: "Invalid item" }, { status: 400, headers })
      }
      items.push({ id, quantity: amount })
    }

    const ids = items.map(item => item.id)
    const codes = await itemCodesFor(ids)
    const uncoded = ids.filter(id => !codes.get(id))
    const software = uncoded.length
      ? new Set((await (await getCollection<{ _id: ObjectId | string; id?: string }>("software_products")).find(
        { $or: [{ _id: { $in: uncoded.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } }, { id: { $in: uncoded } }] },
        { projection: { _id: 1, id: 1 } },
      ).toArray()).flatMap(doc => [doc._id.toString(), doc.id].filter((value): value is string => Boolean(value))))
      : new Set<string>()

    const needs = items
      .filter(item => !software.has(item.id))
      .map(item => ({ sku: codes.get(item.id) ?? null, quantity: item.quantity }))
    const storeIds = await storesHoldingStock(needs)

    return NextResponse.json({ success: true, storeIds: [...storeIds], farDistanceKm: storeFarDistanceKm() }, { headers })
  } catch (error) {
    return handleApiError(error, "Failed to check store stock")
  }
}
