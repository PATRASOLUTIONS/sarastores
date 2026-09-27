import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { handleApiError } from "@/lib/api-error"

export async function GET() {
  try {
    const { db } = await connectToDatabase()

    const testimonials = await db.collection("testimonials").find({}).limit(100).toArray()

    return NextResponse.json({
      success: true,
      testimonials,
    })
  } catch (error) {
    return handleApiError(error, "Error fetching testimonials")
  }
}
