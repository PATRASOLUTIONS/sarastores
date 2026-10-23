import { NextResponse } from "next/server"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { PUBLIC_PRODUCT_FILTER } from "@/lib/product-visibility"
import { IN_STOCK_EXPRESSION, PRODUCT_BRAND_PATHS, firstNonBlank } from "@/lib/mongo-expressions"

/**
 * Brands that have at least one active, in-stock product, busiest first.
 *
 * Public and read-only: it drives the homepage Top Brands rail. Unlike the
 * taxonomy it does not require a `division`, so brands whose products were
 * never classified by the bulk sheet still appear.
 */
export async function GET() {
  try {
    const collection = await getCollection(COLLECTIONS.PRODUCTS)
    const brands = await collection
      .aggregate<{ name: string; count: number }>([
        { $match: { ...PUBLIC_PRODUCT_FILTER, $expr: IN_STOCK_EXPRESSION } },
        { $project: { name: firstNonBlank(PRODUCT_BRAND_PATHS) } },
        { $match: { name: { $ne: "" } } },
        { $group: { _id: { $toLower: "$name" }, name: { $first: "$name" }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $project: { _id: 0, name: 1, count: 1 } },
      ])
      .toArray()

    return NextResponse.json(
      { brands },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
    )
  } catch (error) {
    return handleApiError(error, "Failed to load in-stock brands")
  }
}
