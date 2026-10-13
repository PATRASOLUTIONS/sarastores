import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { MongoServerError, ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"
import { CreateStoreQrSchema, StoreObjectIdSchema } from "@/lib/validation"
import { createTrackedStoreQr, normalizeStoreQr } from "@/lib/store-qr"
import type { StoreQrDocument } from "@/lib/store-qr"
import type { StoredStoreLocation } from "@/lib/store-locations"
import { getOriginFromHeaders } from "@/lib/seo-metadata"

const COLLECTION = "store_qr_codes"

// GET - Fetch all QR codes for a store or all stores
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")

    const parsedId = storeId === null ? null : StoreObjectIdSchema.safeParse(storeId)
    if (parsedId && !parsedId.success) return NextResponse.json({ success: false, message: "Invalid store ID" }, { status: 400 })
    const collection = await getCollection<StoreQrDocument>(COLLECTION)
    const qrCodes = await collection.find(parsedId?.success ? { storeId: parsedId.data } : {}).sort({ createdAt: -1 }).toArray()
    const normalized = qrCodes.map(normalizeStoreQr)

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
    const parsed = CreateStoreQrSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    const { storeId, type } = parsed.data
    const stores = await getCollection<StoredStoreLocation>("store_locations")
    const store = await stores.findOne({ _id: new ObjectId(storeId), isActive: true })
    if (!store) return NextResponse.json({ success: false, message: "Active store not found" }, { status: 404 })
    const collection = await getCollection<StoreQrDocument>(COLLECTION)

    // Check if QR already exists for this store + type
    const existing = await collection.findOne({ storeId, type })
    if (existing) {
      return NextResponse.json(
        { success: false, message: `QR code for ${type} already exists for this store. Use PUT to update.` },
        { status: 409 }
      )
    }

    const qrDoc = await createTrackedStoreQr({ ...parsed.data, storeName: store.shopName || "" }, await getOriginFromHeaders())

    const result = await collection.insertOne(qrDoc)

    return NextResponse.json({
      success: true,
      message: "QR code created successfully",
      id: result.insertedId.toString(),
      qrDataUrl: qrDoc.qrDataUrl,
    })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
    if (error instanceof MongoServerError && error.code === 11000) return NextResponse.json({ success: false, message: "QR code already exists for this store and type" }, { status: 409 })
    console.error("Error creating QR code:", error)
    return NextResponse.json(
      { success: false, message: "Failed to create QR code" },
      { status: 500 }
    )
  }
}
