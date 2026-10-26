import { NextResponse } from "next/server"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { PUBLIC_PRODUCT_FILTER } from "@/lib/product-visibility"
import { PRODUCT_BRAND_PATHS, firstNonBlank } from "@/lib/mongo-expressions"

// Public catalogue navigation includes active products with zero stock too.
export async function GET() {
  try {
    const collection = await getCollection(COLLECTIONS.PRODUCTS)
    const brands = await collection.aggregate<{ name: string; count: number }>([
      { $match: PUBLIC_PRODUCT_FILTER },
      { $project: { name: firstNonBlank(PRODUCT_BRAND_PATHS) } },
      { $match: { name: { $ne: "" } } },
      { $group: { _id: { $toLower: "$name" }, name: { $first: "$name" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, name: 1, count: 1 } },
    ]).toArray()

    return NextResponse.json({ brands }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    })
  } catch (error) {
    return handleApiError(error, "Failed to load active product brands")
  }
}
