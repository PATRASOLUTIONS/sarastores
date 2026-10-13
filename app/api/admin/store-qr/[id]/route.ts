import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"
import { UpdateStoreQrSchema } from "@/lib/validation"
import { normalizeStoreQr, trackedStoreQrImage } from "@/lib/store-qr"
import type { StoreQrDocument } from "@/lib/store-qr"
import { getOriginFromHeaders } from "@/lib/seo-metadata"

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

    const collection = await getCollection<StoreQrDocument>(COLLECTION)
    const qr = await collection.findOne({ _id: new ObjectId(id) })

    if (!qr) {
      return NextResponse.json(
        { success: false, message: "QR code not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      qrCode: normalizeStoreQr(qr),
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
    const parsed = UpdateStoreQrSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid QR code ID" },
        { status: 400 }
      )
    }

    const collection = await getCollection<StoreQrDocument>(COLLECTION)
    const existing = await collection.findOne({ _id: new ObjectId(id) })

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "QR code not found" },
        { status: 404 }
      )
    }

    const updateData = {
      ...parsed.data, updatedAt: new Date(),
      qrDataUrl: await trackedStoreQrImage(id, await getOriginFromHeaders()),
    }
    const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateData })
    if (!result.matchedCount) return NextResponse.json({ success: false, message: "QR code was removed during update" }, { status: 409 })

    return NextResponse.json({ success: true, message: "QR code updated successfully" })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
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
