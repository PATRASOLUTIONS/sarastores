import { type NextRequest, NextResponse } from "next/server"
import { requireVendor } from "@/lib/auth"
import { getAll, create, COLLECTIONS } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { VendorProductSchema } from "@/lib/vendor-products"
import { handleApiError } from "@/lib/api-error"

// Get vendor's products
export async function GET(request: NextRequest) {
  const guard = await requireVendor()
  if (!guard.ok) return guard.response
  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const vendorId = guard.user.role === "admin" || guard.user.role === "superadmin"
      ? searchParams.get("vendorId") || guard.user.id
      : guard.user.id

    // Get products for this vendor
    const products = await getAll(COLLECTIONS.PRODUCTS, { vendorId })

    return NextResponse.json(products)
  } catch (error) {
    return handleApiError(error, "Failed to get vendor products")
  }
}

// Create a new product for vendor
export async function POST(request: NextRequest) {
  const guard = await requireVendor()
  if (!guard.ok) return guard.response

  try {
    await connectToDatabase()

    const parsed = VendorProductSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const { name, description, price, image, stock, category } = parsed.data

    const newProduct = {
      name,
      description,
      price,
      image: image || "/placeholder.svg?height=300&width=300",
      stock,
      category: category || "uncategorized",
      vendorId: guard.user.id,
      active: true,
      createdAt: new Date().toISOString(),
    }

    const product = await create(COLLECTIONS.PRODUCTS, newProduct)

    return NextResponse.json({
      success: true,
      product,
    })
  } catch (error) {
    return handleApiError(error, "Failed to create vendor product")
  }
}
