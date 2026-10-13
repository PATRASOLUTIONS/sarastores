import { NextRequest, NextResponse } from "next/server"
import { MongoServerError, ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import { getOriginFromHeaders } from "@/lib/seo-metadata"
import { BulkStoreQrSchema, StoreHttpUrlSchema } from "@/lib/validation"
import { createTrackedStoreQr, normalizeStoreQr, STORE_QR_DEFAULT_URLS, StoreQrError, storeQrScanUrl } from "@/lib/store-qr"
import type { StoreQrDocument, StoreQrType } from "@/lib/store-qr"
import type { StoredStoreLocation } from "@/lib/store-locations"

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = BulkStoreQrSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    const ids = parsed.data.storeIds
    const origin = await getOriginFromHeaders()
    const storesCol = await getCollection<StoredStoreLocation>("store_locations")
    const qrCol = await getCollection<StoreQrDocument>("store_qr_codes")
    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      const result = await session.withTransaction(async () => {
        const stores = await storesCol.find({ _id: { $in: ids.map(id => new ObjectId(id)) }, isActive: true }, { session }).toArray()
        if (stores.length !== ids.length) throw new StoreQrError("One or more requested stores are missing or inactive", 404)
        const existing = await qrCol.find({ storeId: { $in: ids } }, { session }).toArray()
        const existingPairs = new Set(existing.map(qr => `${qr.storeId}:${qr.type}`))
        const docs: StoreQrDocument[] = []
        const skipped: Array<{ storeId: string; storeName: string; reason: string }> = []
        for (const store of stores) {
          const storeId = store._id.toString()
          const storeName = store.shopName || ""
          for (const type of ["google_maps", "whatsapp", "instagram"] satisfies StoreQrType[]) {
            if (existingPairs.has(`${storeId}:${type}`)) {
              skipped.push({ storeId, storeName, reason: `${type} already exists` })
              continue
            }
            const targetUrl = type === "google_maps" ? store.googleMapLocation : STORE_QR_DEFAULT_URLS[type]
            if (!targetUrl) {
              skipped.push({ storeId, storeName, reason: `No URL configured for ${type}` })
              continue
            }
            if (!StoreHttpUrlSchema.safeParse(targetUrl).success) throw new StoreQrError(`Store has an invalid ${type} URL`, 400)
            docs.push(await createTrackedStoreQr({ storeId, storeName, type, label: "", targetUrl }, origin))
          }
        }
        if (docs.length) await qrCol.insertMany(docs, { session })
        return {
          success: true, message: `Created ${docs.length} QR codes, skipped ${skipped.length}`,
          created: docs.map(qr => {
            if (!qr._id) throw new Error("Generated QR ID is missing")
            return { ...normalizeStoreQr({ ...qr, _id: qr._id }), scanUrl: storeQrScanUrl(qr._id.toHexString(), origin) }
          }),
          skipped,
          summary: { storesProcessed: stores.length, totalCreated: docs.length, totalSkipped: skipped.length },
        }
      })
      if (!result) throw new Error("QR generation transaction did not commit")
      return NextResponse.json(result)
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
    if (error instanceof StoreQrError) return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    if (error instanceof MongoServerError && error.code === 11000) return NextResponse.json({ success: false, message: "QR creation conflicted with another request; reload and retry" }, { status: 409 })
    console.error("Error in bulk QR generation:", error)
    return NextResponse.json({ success: false, message: "Failed to generate QR codes in bulk" }, { status: 500 })
  }
}
