import { type NextRequest, NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { COLLECTIONS } from "@/lib/db-service"

export async function GET(request: NextRequest) {
  try {
    const slides = await dbService.getAll(COLLECTIONS.SLIDES)
    return NextResponse.json(slides)
  } catch (error) {
    console.error("Error fetching product slides:", error)
    return NextResponse.json({ error: "Failed to fetch product slides" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const slide = await dbService.create(COLLECTIONS.SLIDES, data)
    return NextResponse.json(slide)
  } catch (error) {
    console.error("Error creating product slide:", error)
    return NextResponse.json({ error: "Failed to create product slide" }, { status: 500 })
  }
}
