import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import QRCode from "qrcode"
import { requireAdmin } from "@/lib/auth"

const COLLECTION = "store_qr_codes"

// GET - Fetch a single QR code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

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

    return NextResponse.json({
      success: true,
      qrCode: {
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
      },
    })
  } catch (error) {
    console.error("Error fetching QR code:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch QR code" },
      { status: 500 }
    )
  }
}

// PUT - Update a QR code
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await request.json()

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid QR code ID" },
        { status: 400 }
      )
    }

    const collection = await getCollection(COLLECTION)
    const existing = await collection.findOne({ _id: new ObjectId(id) })

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "QR code not found" },
        { status: 404 }
      )
    }

    const updateData: Record<string, any> = { updatedAt: new Date() }

    if (body.targetUrl !== undefined) {
      updateData.targetUrl = body.targetUrl
      // Regenerate QR if URL changed
      if (body.targetUrl !== existing.targetUrl) {
        updateData.qrDataUrl = await QRCode.toDataURL(body.targetUrl, {
          width: 400,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
        })
      }
    }
    if (body.label !== undefined) updateData.label = body.label
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)
    if (body.storeName !== undefined) updateData.storeName = body.storeName

    await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateData })

    return NextResponse.json({ success: true, message: "QR code updated successfully" })
  } catch (error) {
    console.error("Error updating QR code:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update QR code" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a QR code
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid QR code ID" },
        { status: 400 }
      )
    }

    const collection = await getCollection(COLLECTION)
    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "QR code not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: "QR code deleted successfully" })
  } catch (error) {
    console.error("Error deleting QR code:", error)
    return NextResponse.json(
      { success: false, message: "Failed to delete QR code" },
      { status: 500 }
    )
  }
}
