import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    const { db } = await connectToDatabase()

    const advertisements = await db
      .collection("product_advertisements")
      .find({})
      .sort({ order: 1, createdAt: -1 })
      .toArray()

    // Convert ObjectId to string for JSON serialization
    const serializedAdvertisements = advertisements.map((ad) => ({
      ...ad,
      _id: ad._id.toString(),
    }))

    return NextResponse.json(serializedAdvertisements)
  } catch (error) {
    console.error("Error fetching product advertisements:", error)
    return NextResponse.json({ error: "Failed to fetch product advertisements" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.image) {
      return NextResponse.json({ error: "Title and image are required" }, { status: 400 })
    }

    // Get the highest order number and increment by 1
    const lastAd = await db.collection("product_advertisements").findOne({}, { sort: { order: -1 } })

    const nextOrder = lastAd ? (lastAd.order || 0) + 1 : 1

    const advertisement = {
      title: body.title,
      subtitle: body.subtitle || "",
      description: body.description || "",
      image: body.image,
      ctaText: body.ctaText || "",
      ctaLink: body.ctaLink || "",
      backgroundColor: body.backgroundColor || "#1e40af",
      textColor: body.textColor || "#ffffff",
      overlayOpacity: body.overlayOpacity || 50,
      isActive: body.isActive !== undefined ? body.isActive : true,
      order: body.order || nextOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection("product_advertisements").insertOne(advertisement)

    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...advertisement,
    })
  } catch (error) {
    console.error("Error creating product advertisement:", error)
    return NextResponse.json({ error: "Failed to create product advertisement" }, { status: 500 })
  }
}
