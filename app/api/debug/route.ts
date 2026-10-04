import { NextResponse } from "next/server"
import { getMongoClient } from "@/lib/mongodb"

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  try {
    const client = await getMongoClient()
    await client.db().command({ ping: 1 })

    return NextResponse.json({
      status: "ok",
      mongodb: "connected",
      env: {
        NODE_ENV: process.env.NODE_ENV,
        MONGODB_URI_SET: !!process.env.MONGODB_URI,
      },
    })
  } catch (error) {
    console.error("Debug API error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
