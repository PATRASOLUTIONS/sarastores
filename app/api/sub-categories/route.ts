import { type NextRequest, NextResponse } from "next/server"
import { getAll, create, COLLECTIONS } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

// Get all sub-categories
export async function GET() {
  try {
    if (process.env.NODE_ENV === "development") console.log("Fetching sub-categories from MongoDB...")
    const subCategories = await getAll(COLLECTIONS.SUB_CATEGORIES, {}, { limit: 0 })
    if (process.env.NODE_ENV === "development") console.log(`Found ${subCategories.length} sub-categories`)
    return NextResponse.json(subCategories)
  } catch (error) {
    console.error("Error getting sub-categories:", error)
    return NextResponse.json(
      {
        error: "Failed to get sub-categories",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Create a new sub-category
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    if (process.env.NODE_ENV === "development") console.log("Creating new sub-category...")
    const body = await request.json()
    const { name, image, categoryId, active } = body

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Sub-category name is required" }, { status: 400 })
    }

    const newSubCategory = {
      name: name.trim(),
      image: image || "/placeholder.svg?height=100&width=100",
      categoryId: typeof categoryId === "string" ? categoryId : "",
      active: active !== false,
    }

    if (process.env.NODE_ENV === "development") console.log("Creating sub-category with data:", newSubCategory)
    const subCategory = await create(COLLECTIONS.SUB_CATEGORIES, newSubCategory)
    if (process.env.NODE_ENV === "development") console.log("Sub-category created successfully:", subCategory.id)

    return NextResponse.json({
      success: true,
      subCategory,
      message: "Sub-category created successfully",
    })
  } catch (error) {
    console.error("Error creating sub-category:", error)
    return NextResponse.json(
      {
        error: "Failed to create sub-category",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
