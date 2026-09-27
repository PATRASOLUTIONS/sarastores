import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { db } = await connectToDatabase()

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid advertisement ID" }, { status: 400 })
    }

    const advertisement = await db.collection("product_advertisements").findOne({ _id: new ObjectId(id) })

    if (!advertisement) {
      return NextResponse.json({ error: "Advertisement not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...advertisement,
      _id: advertisement._id.toString(),
    })
  } catch (error) {
    console.error("Error fetching product advertisement:", error)
    return NextResponse.json({ error: "Failed to fetch product advertisement" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const { db } = await connectToDatabase()
    const body = await request.json()

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid advertisement ID" }, { status: 400 })
    }

    // Validate required fields
    if (!body.title || !body.image) {
      return NextResponse.json({ error: "Title and image are required" }, { status: 400 })
    }

    const updateData = {
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
      order: body.order || 1,
      updatedAt: new Date(),
    }

    const result = await db
      .collection("product_advertisements")
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Advertisement not found" }, { status: 404 })
    }

    return NextResponse.json({
      _id: id,
      ...updateData,
    })
  } catch (error) {
    console.error("Error updating product advertisement:", error)
    return NextResponse.json({ error: "Failed to update product advertisement" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const { db } = await connectToDatabase()

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid advertisement ID" }, { status: 400 })
    }

    const result = await db.collection("product_advertisements").deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Advertisement not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Advertisement deleted successfully" })
  } catch (error) {
    console.error("Error deleting product advertisement:", error)
    return NextResponse.json({ error: "Failed to delete product advertisement" }, { status: 500 })
  }
}
