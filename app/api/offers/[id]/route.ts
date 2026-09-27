import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { ObjectId } from "mongodb"
import { getCollection, normalizeId } from "@/lib/db-service"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid offer ID" }, { status: 400 })
    }

    const collection = await getCollection("offers")
    const offer = await collection.findOne({ _id: new ObjectId(id) })

    if (!offer) {
      return NextResponse.json({ success: false, error: "Offer not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      offer: normalizeId(offer),
    })
  } catch (error) {
    console.error("Error fetching offer:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch offer" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const body = await request.json()
    const { name, description, originalPrice, offerPrice, discount, image, badge, stock, active } = body

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid offer ID" }, { status: 400 })
    }

    // Basic required fields: name and image
    if (!name || !image) {
      return NextResponse.json({ success: false, error: "Missing required fields: name or image" }, { status: 400 })
    }

    // Coerce numeric values (may be undefined for coupon-only offers)
    const numOriginalPrice = Number(originalPrice)
    const numOfferPrice = Number(offerPrice)
    const numStock = Number(stock)

    // Determine if this is a product-based offer (both prices provided and > 0)
    const isProductOffer = !isNaN(numOriginalPrice) && !isNaN(numOfferPrice) && numOriginalPrice > 0 && numOfferPrice > 0

    // If product offer, perform stricter validation
    if (isProductOffer) {
      if (isNaN(numStock)) {
        return NextResponse.json({ success: false, error: "Invalid numeric values for stock" }, { status: 400 })
      }

      if (numOfferPrice >= numOriginalPrice) {
        return NextResponse.json(
          { success: false, error: "Offer price must be less than original price" },
          { status: 400 },
        )
      }
    }

    const collection = await getCollection("offers")

    const updateData = {
      name: name.trim(),
      description: description?.trim() || "",
      originalPrice: isProductOffer ? numOriginalPrice : 0,
      offerPrice: isProductOffer ? numOfferPrice : 0,
      discount: Number(discount) || (isProductOffer && numOriginalPrice > 0 ? Math.round(((numOriginalPrice - numOfferPrice) / numOriginalPrice) * 100) : 0),
      image: image.trim(),
      badge: badge || "Hot Deal",
      stock: isProductOffer && !isNaN(numStock) ? numStock : 0,
      active: Boolean(active),
      updatedAt: new Date(),
    }

    const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateData })

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: "Offer not found" }, { status: 404 })
    }

    const updatedOffer = await collection.findOne({ _id: new ObjectId(id) })

    return NextResponse.json({
      success: true,
      offer: normalizeId(updatedOffer),
      message: "Offer updated successfully",
    })
  } catch (error) {
    console.error("Error updating offer:", error)
    return NextResponse.json({ success: false, error: "Failed to update offer" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid offer ID" }, { status: 400 })
    }

    const collection = await getCollection("offers")
    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: "Offer not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Offer deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting offer:", error)
    return NextResponse.json({ success: false, error: "Failed to delete offer" }, { status: 500 })
  }
}
