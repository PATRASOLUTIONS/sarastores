import { type NextRequest, NextResponse } from "next/server"
import { requireVendor } from "@/lib/auth"
import { getById, update, deleteById, COLLECTIONS } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"

// Get a single product
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await connectToDatabase()

    const product = await getById(COLLECTIONS.PRODUCTS, id)

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error("Vendor Product API: Error getting product:", error)
    return NextResponse.json(
      {
        error: "Failed to get product",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Update a product
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireVendor()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    await connectToDatabase()

    const body = await request.json()
    const { name, description, price, image, stock, category } = body

    if (!name || !description || price === undefined || stock === undefined) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 })
    }

    const updatedProduct = {
      name,
      description,
      price: Number.parseFloat(price),
      image: image || "/placeholder.svg?height=300&width=300",
      stock: Number.parseInt(stock),
      category: category || "uncategorized",
      updatedAt: new Date().toISOString(),
    }

    const product = await update(COLLECTIONS.PRODUCTS, id, updatedProduct)

    return NextResponse.json({
      success: true,
      product,
    })
  } catch (error) {
    console.error("Vendor Product API: Error updating product:", error)
    return NextResponse.json(
      {
        error: "Failed to update product",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Delete a product
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireVendor()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    await connectToDatabase()

    await deleteById(COLLECTIONS.PRODUCTS, id)

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully",
    })
  } catch (error) {
    console.error("Vendor Product API: Error deleting product:", error)
    return NextResponse.json(
      {
        error: "Failed to delete product",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
