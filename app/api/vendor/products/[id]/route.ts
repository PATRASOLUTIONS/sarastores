import { type NextRequest, NextResponse } from "next/server"
import { requireVendor } from "@/lib/auth"
import { getCollection, normalizeId, COLLECTIONS } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { VendorProductSchema, vendorProductFilter, type VendorProductRecord } from "@/lib/vendor-products"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  const guard = await requireVendor()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const collection = await getCollection<VendorProductRecord>(COLLECTIONS.PRODUCTS)
    const product = await collection.findOne(vendorProductFilter(id, guard.user))
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
    return NextResponse.json(normalizeId(product))
  } catch (error) {
    return handleApiError(error, "Failed to get vendor product")
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const guard = await requireVendor()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const parsed = VendorProductSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const collection = await getCollection<VendorProductRecord>(COLLECTIONS.PRODUCTS)
    const product = await collection.findOneAndUpdate(
      vendorProductFilter(id, guard.user),
      { $set: { ...parsed.data, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    )
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
    return NextResponse.json({ success: true, product: normalizeId(product) })
  } catch (error) {
    return handleApiError(error, "Failed to update vendor product")
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const guard = await requireVendor()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const collection = await getCollection<VendorProductRecord>(COLLECTIONS.PRODUCTS)
    const result = await collection.deleteOne(vendorProductFilter(id, guard.user))
    if (!result.deletedCount) return NextResponse.json({ error: "Product not found" }, { status: 404 })
    return NextResponse.json({ success: true, message: "Product deleted successfully" })
  } catch (error) {
    return handleApiError(error, "Failed to delete vendor product")
  }
}
