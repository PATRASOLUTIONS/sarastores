import { type NextRequest, NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { COLLECTIONS } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const review = await dbService.getById(COLLECTIONS.REVIEWS, id)

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    return NextResponse.json(review)
  } catch (error) {
    console.error("Error fetching review:", error)
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const data = await request.json()
    if (process.env.NODE_ENV === "development") console.log("Updating review:", id, data)

    const review = await dbService.update(COLLECTIONS.REVIEWS, id, data)
    return NextResponse.json(review)
  } catch (error) {
    console.error("Error updating review:", error)
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await dbService.remove(COLLECTIONS.REVIEWS, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting review:", error)
    return handleApiError(error)
  }
}
