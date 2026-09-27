import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    if (process.env.NODE_ENV === "development") console.log("Testing MongoDB connection...")

    const { db } = await connectToDatabase()

    // Test the connection with a simple ping
    await db.admin().ping()

    // Get database stats
    const stats = await db.stats()

    if (process.env.NODE_ENV === "development") console.log("MongoDB connection successful")

    return NextResponse.json({
      status: "connected",
      message: "MongoDB connection successful",
      collections: stats.collections || 0,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("MongoDB connection failed:", error)

    return NextResponse.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        details: "Failed to connect to MongoDB database",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
