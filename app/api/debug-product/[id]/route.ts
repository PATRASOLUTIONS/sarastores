import { type NextRequest, NextResponse } from "next/server"
import { getMongoClient } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { COLLECTIONS } from "@/lib/db-service"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  try {
    const { id } = await context.params
    const client = await getMongoClient()
    const db = client.db("e-commerce-bytewise")

    let docId
    try {
      docId = new ObjectId(id)
    } catch (error) {
      docId = id
    }

    const productWithObjectId = await db.collection(COLLECTIONS.PRODUCTS).findOne({ _id: docId })
    const productWithStringId = await db.collection(COLLECTIONS.PRODUCTS).findOne({ _id: id })

    const allProducts = await db.collection(COLLECTIONS.PRODUCTS).find({}).toArray()
    const matchingProducts = allProducts.filter((p) => p._id.toString() === id || (p.id && p.id === id))

    return NextResponse.json({
      requestedId: id,
      objectIdVersion: docId instanceof ObjectId ? docId.toString() : docId,
      productWithObjectId,
      productWithStringId,
      matchingProducts,
      allProductIds: allProducts.map((p) => ({
        _id: p._id.toString(),
        id: p.id,
      })),
    })
  } catch (error) {
    console.error("Error in debug endpoint:", error)
    return NextResponse.json(
      {
        error: "Failed to debug product",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
