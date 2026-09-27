import { NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { COLLECTIONS } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"

export async function GET() {
  try {
    const advertisements = await dbService.getAll(COLLECTIONS.ADVERTISEMENTS)
    return NextResponse.json(advertisements)
  } catch (error) {
    console.error("Error fetching advertisements:", error)
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Ensure required fields are present
    const requiredFields = ["title", "description", "buttonText", "buttonLink", "bgColor", "textColor"]
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Set default values for optional fields
    const advertisementData = {
      ...data,
      active: data.active !== undefined ? data.active : true,
      featured: data.featured !== undefined ? data.featured : false,
      order: data.order !== undefined ? data.order : 0,
      createdAt: new Date().toISOString(),
    }

    const result = await dbService.create(COLLECTIONS.ADVERTISEMENTS, advertisementData)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating advertisement:", error)
    return handleApiError(error)
  }
}
