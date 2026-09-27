import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET(_request: NextRequest, context: { params: Promise<{ sku: string }> }) {
  try {
    const { params } = context
    const { sku } = await params

    const { db } = await connectToDatabase()
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

  const { sku } = await context.params
  const data = await req.json()
  const { db } = await connectToDatabase()
  const result = await db.collection("products").updateOne(
    { sku },
    {
      $set: {
        name: data.name,
        description: data.description,
        price: data.price,
        images: data.images,
      }
    },
  )
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, context: { params: Promise<{ sku: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const { sku } = await context.params
  const data = await req.json()
  const { db } = await connectToDatabase()
  const specsCollection = db.collection("product_specifications")

  const existing = await specsCollection.findOne({ sku })
  if (!existing) {
    return NextResponse.json({ error: "Specifications not found for SKU" }, { status: 404 })
  }

  // If the specification is locked, disallow arbitrary updates unless the request explicitly includes a `locked` field
  if (existing.locked && typeof data.locked === 'undefined') {
    return NextResponse.json({ error: "Specifications are locked and cannot be modified" }, { status: 409 })
  }

  const allowed: any = {}
  if (typeof data.name !== 'undefined') allowed.name = data.name
  if (typeof data.mrp !== 'undefined') allowed.mrp = data.mrp
  if (typeof data.description !== 'undefined') allowed.description = data.description
  if (typeof data.technical_details !== 'undefined') allowed.technical_details = data.technical_details
  if (typeof data.from_manufacturer !== 'undefined') allowed.from_manufacturer = data.from_manufacturer
  if (typeof data.specification_images !== 'undefined') allowed.specification_images = data.specification_images
  if (typeof data.product_id !== 'undefined') allowed.product_id = data.product_id
  if (typeof data.locked !== 'undefined') allowed.locked = !!data.locked
  if (typeof data.overview !== 'undefined') allowed.overview = data.overview
  if (typeof data.category !== 'undefined') allowed.category = data.category
  if (typeof data.subCategory !== 'undefined') allowed.subCategory = data.subCategory
  if (typeof data.included_components !== 'undefined') allowed.included_components = data.included_components
  if (typeof data.features !== 'undefined') allowed.features = data.features
  if (typeof data.isSynced !== 'undefined') allowed.isSynced = !!data.isSynced
  if (typeof data.prod_desc !== 'undefined') allowed.prod_desc = data.prod_desc
  if (typeof data.group_name !== 'undefined') allowed.group_name = data.group_name
  if (typeof data.char_desc !== 'undefined') allowed.char_desc = data.char_desc
  if (typeof data.manufacturer_name !== 'undefined') allowed.manufacturer_name = data.manufacturer_name

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields provided for update" }, { status: 400 })
  }

  // If isSynced is NOT explicitly provided, and we are updating other fields, mark as unsynced
  if (typeof allowed.isSynced === 'undefined') {
    allowed.isSynced = false
  }

  await specsCollection.updateOne({ sku }, { $set: { ...allowed, updatedAt: new Date().toISOString() } })

  // Fetch and return the updated specification
  const updated = await specsCollection.findOne({ sku })

  return NextResponse.json({
    ok: true,
    data: updated
  })
}

export async function DELETE(_req: Request, context: { params: Promise<{ sku: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

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

  await specsCollection.deleteOne({ sku })
  return NextResponse.json({ ok: true })
}