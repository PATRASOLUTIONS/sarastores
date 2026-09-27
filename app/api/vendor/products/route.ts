import { type NextRequest, NextResponse } from "next/server"
import { requireVendor } from "@/lib/auth"
import { getAll, create, COLLECTIONS } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"

// Get vendor's products
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get("vendorId")

    if (!vendorId) {
      return NextResponse.json({ error: "Vendor ID is required" }, { status: 400 })
    }

    // Get products for this vendor
    const products = await getAll(COLLECTIONS.PRODUCTS, { vendorId })

    return NextResponse.json(products)
  } catch (error) {
    console.error("Vendor Products API: Error getting products:", error)
    return NextResponse.json(
      {
        error: "Failed to get products from database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Create a new product for vendor
export async function POST(request: NextRequest) {
  const guard = await requireVendor()
  if (!guard.ok) return guard.response

  try {
    await connectToDatabase()

    const body = await request.json()
    const { name, description, price, image, stock, category, vendorId } = body

    if (!name || !description || price === undefined || stock === undefined || !vendorId) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 })
    }

    const newProduct = {
      name,
      description,
      price: Number.parseFloat(price),
      image: image || "/placeholder.svg?height=300&width=300",
      stock: Number.parseInt(stock),
      category: category || "uncategorized",
      vendorId,
      active: true,
      createdAt: new Date().toISOString(),
    }

    const product = await create(COLLECTIONS.PRODUCTS, newProduct)

    return NextResponse.json({
      success: true,
      product,
    })
  } catch (error) {
    console.error("Vendor Products API: Error creating product:", error)
    return NextResponse.json(
      {
        error: "Failed to create product in database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
