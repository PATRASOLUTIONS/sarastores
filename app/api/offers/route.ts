import { NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { isOfferLive, normalizeOfferSection } from "@/lib/offer-sections"

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const section = params.get("section")
    const liveOnly = params.get("live") === "true"

    const collection = await getCollection("offers")
    const query: Record<string, unknown> = {}
    if (section) query.section = section

    const offers = await collection.find(query).sort({ createdAt: -1 }).toArray()
    const normalizedOffers = normalizeId(offers) || []

    // Expiry is applied here rather than in the query so legacy offers with no
    // endsAt keep showing.
    const visible = liveOnly ? normalizedOffers.filter((o: any) => isOfferLive(o)) : normalizedOffers

    return NextResponse.json({
      success: true,
      offers: visible,
    })
  } catch (error) {
    console.error("Error fetching offers:", error)

    // Return empty array as fallback
    return NextResponse.json({
      success: true,
      offers: [],
    })
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const { name, description, originalPrice, offerPrice, discount, image, badge, stock, active, section, storeIds, endsAt } = body
    // Basic required fields: coupon code/name and image
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

    // Build offer object. For coupon-only offers we default numeric fields to 0.
    const offerData = {
      name: name.trim(),
      description: description?.trim() || "",
      originalPrice: isProductOffer ? numOriginalPrice : 0,
      offerPrice: isProductOffer ? numOfferPrice : 0,
      discount: Number(discount) || (isProductOffer && numOriginalPrice > 0 ? Math.round(((numOriginalPrice - numOfferPrice) / numOriginalPrice) * 100) : 0),
      image: image.trim(),
      badge: badge || "Hot Deal",
      stock: isProductOffer && !isNaN(numStock) ? numStock : 0,
      active: Boolean(active),
      section: normalizeOfferSection(section),
      storeIds: Array.isArray(storeIds) ? storeIds.map(String).slice(0, 200) : [],
      endsAt: endsAt ? new Date(endsAt) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(offerData)
    const insertedOffer = await collection.findOne({ _id: result.insertedId })

    return NextResponse.json({
      success: true,
      offer: normalizeId(insertedOffer),
      message: "Offer created successfully",
    })
  } catch (error) {
    console.error("Error creating offer:", error)
    return NextResponse.json({ success: false, error: "Failed to create offer" }, { status: 500 })
  }
}
