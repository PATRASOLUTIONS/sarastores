import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { StoreHttpUrlSchema } from "@/lib/validation"
import type { StoreQrDocument } from "@/lib/store-qr"

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

    const collection = await getCollection<StoreQrDocument>(COLLECTION)
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
    if (!StoreHttpUrlSchema.safeParse(qr.targetUrl).success) throw new Error("Stored QR target must use HTTP(S)")

    // Capture scan metadata
    const scanEntry = {
      timestamp: new Date(),
      userAgent: (request.headers.get("user-agent") || "Unknown").slice(0, 512),
      referer: (request.headers.get("referer") || "").slice(0, 2048),
      ip: (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "Unknown").slice(0, 64),
    }

    // Increment scan count and add to history (keep last 500 entries)
    const result = await collection.updateOne(
      { _id: new ObjectId(id), isActive: true, targetUrl: qr.targetUrl },
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
    if (!result.matchedCount) return NextResponse.json({ success: false, message: "QR code changed; scan again" }, { status: 409 })

    // Redirect to the target URL
    return NextResponse.redirect(qr.targetUrl, { status: 307, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Error tracking scan:", error)
    return NextResponse.json(
      { success: false, message: "Failed to process scan" },
      { status: 500 }
    )
  }
}
