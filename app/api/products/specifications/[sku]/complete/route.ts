import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

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

    // Return the entire document as-is (all fields from the collection)
    return NextResponse.json(completeSpec)
  } catch (error) {
    console.error("ByteWise Testing Point Error fetching complete product specifications by SKU:", error)
    return NextResponse.json(
      { error: "Failed to fetch complete specifications", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
