import { NextResponse } from "next/server"
import { getMongoClient } from "@/lib/mongodb"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    // Test the database connection
    const client = await getMongoClient()
    const db = client.db("ecommerce")

    // Get the list of collections
    const collections = await db.listCollections().toArray()
    const collectionNames = collections.map((c) => c.name)

    // Get a count of documents in each collection
    const counts = {}
    for (const name of collectionNames) {
      counts[name] = await db.collection(name).countDocuments()
    }

    return NextResponse.json({
      status: "connected",
      database: "ecommerce",
      collections: collectionNames,
      documentCounts: counts,
    })
  } catch (error) {
    console.error("Database connection test failed:", error)
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
