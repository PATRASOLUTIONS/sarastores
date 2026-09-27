import { type NextRequest, NextResponse } from "next/server"
import { getAll, create, COLLECTIONS } from "@/lib/db-service"

export async function GET() {
  try {
    const banners = await getAll(COLLECTIONS.ANIMATED_BANNERS)
    return NextResponse.json(banners || [])
  } catch (error) {
    console.error("Error fetching animated banners:", error)
    // Return empty array instead of error to prevent client-side errors
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.description || !data.buttonText) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, and buttonText are required" },
        { status: 400 },
      )
    }

    const result = await create(COLLECTIONS.ANIMATED_BANNERS, data)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating animated banner:", error)
    return NextResponse.json({ error: "Failed to create animated banner" }, { status: 500 })
  }
}
