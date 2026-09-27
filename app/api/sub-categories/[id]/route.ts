import { type NextRequest, NextResponse } from "next/server"
import { getById, update, deleteById, COLLECTIONS } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

// Get single sub-category
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const subCategory = await getById(COLLECTIONS.SUB_CATEGORIES, id)
    
    if (!subCategory) {
      return NextResponse.json({ error: "Sub-category not found" }, { status: 404 })
    }

    return NextResponse.json(subCategory)
  } catch (error) {
    console.error("Error getting sub-category:", error)
    return NextResponse.json(
      {
        error: "Failed to get sub-category",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Update sub-category
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const body = await request.json()
    const { name, image, active, categoryId } = body

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Sub-category name is required" }, { status: 400 })
    }

    const updateData = {
      name: name.trim(),
      image: image || "/placeholder.svg?height=100&width=100",
      categoryId: typeof categoryId === "string" ? categoryId : "",
      active: active !== undefined ? active : true,
    }

    const updatedSubCategory = await update(COLLECTIONS.SUB_CATEGORIES, id, updateData)

    return NextResponse.json({
      success: true,
      subCategory: updatedSubCategory,
      message: "Sub-category updated successfully",
    })
  } catch (error) {
    console.error("Error updating sub-category:", error)
    return NextResponse.json(
      {
        error: "Failed to update sub-category",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Delete sub-category
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    await deleteById(COLLECTIONS.SUB_CATEGORIES, id)

    return NextResponse.json({
      success: true,
      message: "Sub-category deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting sub-category:", error)
    return NextResponse.json(
      {
        error: "Failed to delete sub-category",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
