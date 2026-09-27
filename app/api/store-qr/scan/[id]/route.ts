import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"

const COLLECTION = "store_qr_codes"

// GET - Track a scan and redirect to the target URL
// This is a PUBLIC endpoint (no auth required) - called when someone scans the QR code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid QR code ID" },
        { status: 400 }
      )
    }

    const collection = await getCollection(COLLECTION)
    const qr = await collection.findOne({ _id: new ObjectId(id) })

    if (!qr) {
      return NextResponse.json(
        { success: false, message: "QR code not found" },
        { status: 404 }
      )
    }

    if (!qr.isActive) {
      return NextResponse.json(
        { success: false, message: "This QR code is inactive" },
        { status: 410 }
      )
    }

    // Capture scan metadata
    const scanEntry = {
      timestamp: new Date(),
      userAgent: request.headers.get("user-agent") || "Unknown",
      referer: request.headers.get("referer") || "",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "Unknown",
    }

    // Increment scan count and add to history (keep last 500 entries)
    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { scanCount: 1 },
        $set: { lastScannedAt: new Date(), updatedAt: new Date() },
        $push: {
          scanHistory: {
            $each: [scanEntry],
            $slice: -500,
          },
        },
      }
    )

    // Redirect to the target URL
    return NextResponse.redirect(qr.targetUrl)
  } catch (error) {
    console.error("Error tracking scan:", error)
    // Still redirect even if tracking fails
    try {
      const { id } = await params
      const collection = await getCollection(COLLECTION)
      const qr = await collection.findOne({ _id: new ObjectId(id) })
      if (qr?.targetUrl) {
        return NextResponse.redirect(qr.targetUrl)
      }
    } catch {}
    return NextResponse.json(
      { success: false, message: "Failed to process scan" },
      { status: 500 }
    )
  }
}
