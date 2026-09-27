import { type NextRequest, NextResponse } from "next/server"
import { getMongoClient } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { COLLECTIONS } from "@/lib/db-service"
import { checkAdminAuthorization } from "@/lib/auth"

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  const auth = await checkAdminAuthorization()
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const ALLOWED_FIELDS = ['name', 'price', 'comparePrice', 'description', 'stock', 'sku', 'status', 'category', 'subcategory', 'brand', 'images', 'specifications', 'tags', 'slug', 'hsnCode', 'warranty'] as const;

    const rawData = await request.json()
    const allowedSet = new Set<string>(ALLOWED_FIELDS)
    const data = Object.fromEntries(
      Object.entries(rawData).filter(([key]) => allowedSet.has(key))
    )

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 })
    }

    const client = await getMongoClient()
    const db = client.db("ecommerce")
    const collection = db.collection(COLLECTIONS.PRODUCTS)

    const results: any[] = []

    try {
      const objectId = new ObjectId(id)
      const result1 = await collection.updateOne({ _id: objectId }, { $set: data })
      results.push({ method: "ObjectId", result: result1 })
    } catch (error) {
      // ignore
    }

    try {
      const result2 = await collection.updateOne({ _id: id }, { $set: data })
      results.push({ method: "String ID", result: result2 })
    } catch (error) {
      // ignore
    }

    try {
      const result3 = await collection.updateOne({ id: id }, { $set: data })
      results.push({ method: "id field", result: result3 })
    } catch (error) {
      // ignore
    }

    const successful = results.some((r) => r.result.matchedCount > 0)

    if (!successful) {
      return NextResponse.json(
        { error: "Failed to update product", message: "No matching document found with any ID format", results },
        { status: 404 },
      )
    }

    let updatedProduct = null
    try {
      const objectId = new ObjectId(id)
      updatedProduct = await collection.findOne({ _id: objectId })
    } catch (error) {
      updatedProduct = await collection.findOne({ _id: id })
      if (!updatedProduct) {
        updatedProduct = await collection.findOne({ id: id })
      }
    }

    if (!updatedProduct) {
      return NextResponse.json({ error: "Failed to retrieve updated product", results }, { status: 500 })
    }

    const { _id, ...rest } = updatedProduct
    const normalizedProduct = { id: _id.toString(), ...rest }

    return NextResponse.json({ product: normalizedProduct, results })
  } catch (error) {
    console.error("Error in direct update:", error)
    return NextResponse.json(
      { error: "Failed to update product", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
