import { connectDB } from "@/lib/db"
import { getCollection } from "@/lib/db-service"
import { extractCanonicalProductMetadata } from "@/lib/product-schema"
import { requireAdmin } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

interface ProductUpdate {
  name?: string
  description?: string
  price?: number
  category?: string
  subCategory?: string
  images?: string[]
  [key: string]: unknown
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ sku: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const { sku } = await params
  const canonicalSku = extractCanonicalProductMetadata({ sku }).itemno || sku.trim()

  try {
    await connectDB()

    const updateData: ProductUpdate = await req.json()

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date()
    }

    if (updateData.name !== undefined && updateData.name !== null) {
      updateFields.name = updateData.name
    }
    if (updateData.description !== undefined && updateData.description !== null) {
      updateFields.description = updateData.description
    }
    if (updateData.price !== undefined && updateData.price !== null) {
      updateFields.price = updateData.price
    }
    if (updateData.category !== undefined && updateData.category !== null) {
      updateFields.category = updateData.category
    }
    if (updateData.subCategory !== undefined && updateData.subCategory !== null) {
      updateFields.subCategory = updateData.subCategory
    }
    if (updateData.images !== undefined && Array.isArray(updateData.images)) {
      updateFields.images = updateData.images
      if (updateData.images.length > 0) {
        updateFields.image = updateData.images[0]
      } else {
        updateFields.image = null
      }
    }

    const collection = await getCollection("products")

    const product = await collection.findOne({
      $or: [
        { itemno: canonicalSku },
        { sku: canonicalSku },
        { "raw.itemno": canonicalSku }
      ]
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const document = await collection.findOneAndUpdate(
      { _id: product._id },
      { $set: updateFields },
      { returnDocument: 'after' }
    )

    if (!document) {
      console.error(`[API Products PUT /sku/${sku}] Failed to update product - No document returned`)
      return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
    }

    if (updateData.images !== undefined) {
      const sentCount = updateData.images.length
      const savedCount = document.images?.length || 0
      if (sentCount !== savedCount) {
        console.error(`[API Products PUT /sku/${sku}] IMAGE MISMATCH: Sent ${sentCount} but saved ${savedCount}`)
      }
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error(`[API Products PUT /sku/${sku}] Error updating product:`, error)
    return NextResponse.json(
      { error: "Failed to update product", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params
  const canonicalSku = extractCanonicalProductMetadata({ sku }).itemno || sku.trim()
  const { searchParams } = new URL(req.url)
  const checkOnly = searchParams.get('check') === 'true'

  try {
    const collection = await getCollection("products")

    const product = await collection.findOne({
      $or: [
        { itemno: canonicalSku },
        { sku: canonicalSku },
        { "raw.itemno": canonicalSku }
      ]
    })

    if (!product) {
      if (checkOnly) {
        return NextResponse.json({ found: false })
      }
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    if (checkOnly) {
      return NextResponse.json({ found: true, product: product })
    }

    return NextResponse.json(product)
  } catch {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 })
  }
}
