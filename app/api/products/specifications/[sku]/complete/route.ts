import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { normalizeId } from "@/lib/db-service"

export async function GET(_request: NextRequest, context: { params: Promise<{ sku: string }> }) {
  try {
    const { params } = context
    const { sku } = await params

    const { db } = await connectToDatabase()
    const specsCollection = db.collection("product_specifications")

    // Fetch COMPLETE document from product_specifications collection
    const completeSpec = await specsCollection.findOne({ sku })

    if (!completeSpec) {
      return NextResponse.json({ error: "Specifications not found for SKU" }, { status: 404 })
    }

    // Every field, but with the raw _id swapped for a string id like the rest
    // of the API — clients are never shown _id.
    return NextResponse.json(normalizeId(completeSpec))
  } catch (error) {
    console.error("ByteWise Testing Point Error fetching complete product specifications by SKU:", error)
    // Logged above rather than returned: this endpoint is public and driver
    // errors name hosts and collections.
    return NextResponse.json({ error: "Failed to fetch complete specifications" }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
