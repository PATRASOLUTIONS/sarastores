import { type NextRequest, NextResponse } from "next/server"
import { getAll, create, COLLECTIONS } from "@/lib/db-service"

export async function GET() {
  try {
    const cards = await getAll(COLLECTIONS.SPLIT_CARDS)
    return NextResponse.json(cards || [])
  } catch (error) {
    console.error("Error fetching split cards:", error)
    // Return empty array instead of error to prevent client-side errors
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.description || !data.icon) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, and icon are required" },
        { status: 400 },
      )
    }

    const result = await create(COLLECTIONS.SPLIT_CARDS, data)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating split card:", error)
    return NextResponse.json({ error: "Failed to create split card" }, { status: 500 })
  }
}
