import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { handleApiError } from "@/lib/api-error"

export async function GET() {
  try {
    const { db } = await connectToDatabase()

    const products = await db.collection("featured_products").find({}).limit(50).toArray()

    return NextResponse.json({
      success: true,
      products,
    })
  } catch (error) {
    return handleApiError(error, "Error fetching featured products")
  }
}
