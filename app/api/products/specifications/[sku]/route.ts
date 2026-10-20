import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"
import { normalizeId } from "@/lib/db-service"
import { SpecificationUpdateSchema, UpdateProductSchema } from "@/lib/validation"
import { handleApiError } from "@/lib/api-error"
import { PUBLIC_PRODUCT_FILTER } from "@/lib/product-visibility"

export async function GET(_request: NextRequest, context: { params: Promise<{ sku: string }> }) {
  try {
    const { params } = context
    const { sku } = await params

    const { db } = await connectToDatabase()
    const product = await db.collection("products").findOne(
      {
        ...PUBLIC_PRODUCT_FILTER,
        $or: [{ sku }, { itemno: sku }, { "raw.itemno": sku }],
      },
      { projection: { _id: 1 } },
    )
    if (!product) {
      return NextResponse.json({ error: "Specifications not found for SKU" }, { status: 404 })
    }
    const specsCollection = db.collection("product_specifications")

    const spec = await specsCollection.findOne({ sku })

    if (!spec) {
      return NextResponse.json({ error: "Specifications not found for SKU" }, { status: 404 })
    }

    const specifications = {
      technical_details: spec.technical_details || null,
      from_manufacturer: spec.from_manufacturer || null,
      specification_images: spec.specification_images || null,
      reviews: spec.reviews || null,
      mrp: spec.mrp || null,
      overview: spec.overview || spec.description || null,
      included_components: spec.included_components || null,
      features: spec.features || null,
    }

    return NextResponse.json(specifications)
  } catch (error) {
    console.error("ByteWise Testing Point Error fetching product specifications by SKU:", error)
    return NextResponse.json(
      { error: "Failed to fetch specifications", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(req: Request, context: { params: Promise<{ sku: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { sku } = await context.params
    let body: unknown
    try { body = await req.json() } catch (error) {
      console.warn("Invalid product specification JSON:", error)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = UpdateProductSchema.pick({ name: true, description: true, price: true, images: true })
      .strict().refine(value => Object.keys(value).length > 0, "Provide a product update").safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product update" }, { status: 400 })
    const { db } = await connectToDatabase()
    const updated = await db.collection("products").findOneAndUpdate(
      { sku, ...(parsed.data.price === undefined ? {} : {
        $or: [{ mrp: { $exists: false } }, { mrp: null }, { mrp: { $gte: parsed.data.price } }],
      }) },
      { $set: { ...parsed.data, updatedAt: new Date() } }, { returnDocument: "after" },
    )
    if (!updated) return NextResponse.json({ error: "Product is missing or the price exceeds its MRP" }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, "Failed to update product")
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ sku: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
  const { sku } = await context.params
  let body: unknown
  try { body = await req.json() } catch (error) {
    console.warn("Invalid specification update JSON:", error)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = SpecificationUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid specification update" }, { status: 400 })
  const data = parsed.data
  const { db } = await connectToDatabase()
  const specsCollection = db.collection("product_specifications")

  const existing = await specsCollection.findOne({ sku })
  if (!existing) {
    return NextResponse.json({ error: "Specifications not found for SKU" }, { status: 404 })
  }

  if (existing.locked && !(Object.keys(data).length === 1 && typeof data.locked === "boolean")) {
    return NextResponse.json({ error: "Specifications are locked and cannot be modified" }, { status: 409 })
  }

  const updated = await specsCollection.findOneAndUpdate({
    _id: existing._id,
    locked: existing.locked === undefined ? { $exists: false } : existing.locked,
    updatedAt: existing.updatedAt === undefined ? { $exists: false } : existing.updatedAt,
  }, { $set: { ...data, isSynced: data.isSynced ?? false, updatedAt: new Date() } }, { returnDocument: "after" })
  if (!updated) return NextResponse.json({ error: "Specification changed before this update; reload and try again" }, { status: 409 })

  return NextResponse.json({
    ok: true,
    data: normalizeId(updated)
  })
  } catch (error) {
    return handleApiError(error, "Failed to update specification")
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ sku: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
  const { sku } = await context.params
  const { db } = await connectToDatabase()
  const specsCollection = db.collection("product_specifications")

  const existing = await specsCollection.findOne({ sku })
  if (!existing) {
    return NextResponse.json({ error: "Specifications not found for SKU" }, { status: 404 })
  }

  if (existing.locked) {
    return NextResponse.json({ error: "Specifications are locked and cannot be deleted" }, { status: 409 })
  }

  const result = await specsCollection.deleteOne({
    _id: existing._id, locked: { $ne: true },
    updatedAt: existing.updatedAt === undefined ? { $exists: false } : existing.updatedAt,
  })
  if (!result.acknowledged || result.deletedCount !== 1) {
    return NextResponse.json({ error: "Specification changed before deletion; reload and try again" }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error, "Failed to delete specification")
  }
}