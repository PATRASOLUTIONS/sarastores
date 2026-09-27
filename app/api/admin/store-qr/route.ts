import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import QRCode from "qrcode"
import { requireAdmin } from "@/lib/auth"

const COLLECTION = "store_qr_codes"

// GET - Fetch all QR codes for a store or all stores
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")

    const collection = await getCollection(COLLECTION)
    const filter: Record<string, any> = {}
    if (storeId) filter.storeId = storeId

    const qrCodes = await collection.find(filter).sort({ createdAt: -1 }).toArray()

    const normalized = qrCodes.map((qr) => ({
      id: qr._id.toString(),
      storeId: qr.storeId || "",
      storeName: qr.storeName || "",
      type: qr.type || "google_maps",
      label: qr.label || "",
      targetUrl: qr.targetUrl || "",
      qrDataUrl: qr.qrDataUrl || "",
      scanCount: qr.scanCount || 0,
      lastScannedAt: qr.lastScannedAt || null,
      scanHistory: qr.scanHistory || [],
      isActive: qr.isActive !== false,
      createdAt: qr.createdAt,
      updatedAt: qr.updatedAt,
    }))

    return NextResponse.json({ success: true, qrCodes: normalized })
  } catch (error) {
    console.error("Error fetching QR codes:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch QR codes" },
      { status: 500 }
    )
  }
}

// POST - Create a new QR code
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const { storeId, storeName, type, label, targetUrl } = body

    if (!storeId || !type || !targetUrl) {
      return NextResponse.json(
        { success: false, message: "storeId, type, and targetUrl are required" },
        { status: 400 }
      )
    }

    if (!["google_maps", "whatsapp", "instagram"].includes(type)) {
      return NextResponse.json(
        { success: false, message: "Type must be google_maps, whatsapp, or instagram" },
        { status: 400 }
      )
    }

    // Generate QR code data URL
    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })

    const collection = await getCollection(COLLECTION)

    // Check if QR already exists for this store + type
    const existing = await collection.findOne({ storeId, type })
    if (existing) {
      return NextResponse.json(
        { success: false, message: `QR code for ${type} already exists for this store. Use PUT to update.` },
        { status: 409 }
      )
    }

    const qrDoc = {
      storeId,
      storeName: storeName || "",
      type,
      label: label || "",
      targetUrl,
      qrDataUrl,
      scanCount: 0,
      lastScannedAt: null,
      scanHistory: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(qrDoc)

    return NextResponse.json({
      success: true,
      message: "QR code created successfully",
      id: result.insertedId.toString(),
      qrDataUrl,
    })
  } catch (error) {
    console.error("Error creating QR code:", error)
    return NextResponse.json(
      { success: false, message: "Failed to create QR code" },
      { status: 500 }
    )
  }
}
