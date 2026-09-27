import { type NextRequest, NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { COLLECTIONS } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const category = await dbService.getById(COLLECTIONS.CATEGORIES, id)

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error("Error fetching category:", error)
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const data = await request.json()
    const category = await dbService.update(COLLECTIONS.CATEGORIES, id, data)
    return NextResponse.json(category)
  } catch (error) {
    console.error("Error updating category:", error)
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    await dbService.remove(COLLECTIONS.CATEGORIES, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting category:", error)
    return handleApiError(error)
  }
}
