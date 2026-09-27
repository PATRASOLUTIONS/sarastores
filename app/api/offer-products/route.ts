import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

// No static defaults: return whatever is in DB (empty array if none)

export async function GET() {
  try {
    const { db } = await connectToDatabase()

    // Try to get offers from the database
    let offers = await db.collection("offers").find({}).limit(50).toArray()

    // Return whatever is present in the DB (may be empty)

    return NextResponse.json({
      success: true,
      offers,
    })
  } catch (error) {
    console.error("Error fetching special offers:", error)

    // There are no static defaults; fail soft with an empty list.
    return NextResponse.json({
      success: true,
      offers: [],
    })
  }
}
