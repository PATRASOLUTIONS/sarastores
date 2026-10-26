import { NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { storeFarDistanceKm, getStoreStockAvailability } from "@/lib/store-stock"
import { priceOrder, priceCatalogueCart } from "@/lib/order-pricing"

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
      const segments = pair.split(":")
      const [id, quantity] = segments
      const amount = Number(quantity ?? 1)
      if (segments.length > 2 || !id || id.length > 100 || (quantity !== undefined && !/^[1-9]\d*$/.test(quantity)) || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000) {
        return NextResponse.json({ error: "Invalid item" }, { status: 400, headers })
      }
      items.push({ id, quantity: amount })
    }

    const grouped = new Map<string, number>()
    for (const item of items) grouped.set(item.id, (grouped.get(item.id) || 0) + item.quantity)
    const groupedItems = [...grouped].map(([id, quantity]) => ({ id, quantity }))
    const catalogue = await priceCatalogueCart(groupedItems, undefined, "store")
    if (!catalogue.ok) return NextResponse.json({ success: true, storeIds: [], byStore: {}, deliveryAvailable: false,
      availabilityError: catalogue.error, farDistanceKm: storeFarDistanceKm() }, { headers })
    const needs = catalogue.items.filter(item => item.type !== "software")
      .map(item => ({ sku: item.sku?.trim() || null, itemCode: item.itemNumbers?.[0] || item.sku, quantity: item.quantity }))
    const availability = await getStoreStockAvailability(needs)
    // Catalogue stock includes warehouses and other stores. Never trust the
    // browser's stock field when offering a delivery fallback.
    const deliveryQuote = await priceOrder(groupedItems, { userId: null })

    return NextResponse.json({ success: true, storeIds: [...availability.storeIds], byStore: availability.byStore,
      availabilityError: deliveryQuote.ok ? "" : deliveryQuote.error,
      deliveryAvailable: deliveryQuote.ok, farDistanceKm: storeFarDistanceKm() }, { headers })
  } catch (error) {
    return handleApiError(error, "Failed to check store stock")
  }
}
