import { type NextRequest, NextResponse } from "next/server"
import { ObjectId, type Document } from "mongodb"
import { getCollection, normalizeId, COLLECTIONS } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { DirectProductUpdateSchema } from "@/lib/validation"

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const parsed = DirectProductUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const collection = await getCollection<Document & { _id: ObjectId | string }>(COLLECTIONS.PRODUCTS)
    let product = ObjectId.isValid(id) ? await collection.findOne({ _id: new ObjectId(id) }) : null
    if (!product) product = await collection.findOne({ _id: id })
    if (!product) product = await collection.findOne({ id })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const result = await collection.updateOne({ _id: product._id }, {
      $set: { ...parsed.data, updatedAt: new Date() },
    })
    if (!result.acknowledged) throw new Error("Product update was not acknowledged")
    if (result.matchedCount !== 1) return NextResponse.json({ error: "Product changed; reload before updating" }, { status: 409 })
    const updated = await collection.findOne({ _id: product._id })
    if (!updated) throw new Error("Updated product could not be reloaded")
    return NextResponse.json({ product: normalizeId(updated) })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    return handleApiError(error, "Failed to update product")
  }
}
