import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    const { db } = await connectToDatabase()

    // Test the connection by getting the collections
    const collections = await db.listCollections().toArray()

    return NextResponse.json({
      success: true,
      message: "Successfully connected to MongoDB",
      database: "e-commerce-bytewise",
      collections: collections.map((col) => col.name),
    })
  } catch (error) {
    console.error("Database connection error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to MongoDB",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
