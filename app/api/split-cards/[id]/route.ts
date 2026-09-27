import { type NextRequest, NextResponse } from "next/server"
import { getById, update, remove, COLLECTIONS } from "@/lib/db-service"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const card = await getById(COLLECTIONS.SPLIT_CARDS, id)

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    return NextResponse.json(card)
  } catch (error) {
    console.error(`Error fetching split card ${id}:`, error)
    return NextResponse.json({ error: "Failed to fetch split card" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.description || !data.icon) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, and icon are required" },
        { status: 400 },
      )
    }

    const result = await update(COLLECTIONS.SPLIT_CARDS, id, data)
    return NextResponse.json(result)
  } catch (error) {
    console.error(`Error updating split card ${id}:`, error)
    return NextResponse.json({ error: "Failed to update split card" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    await remove(COLLECTIONS.SPLIT_CARDS, id)
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error(`Error deleting split card ${id}:`, error)
    return NextResponse.json({ error: "Failed to delete split card" }, { status: 500 })
  }
}
