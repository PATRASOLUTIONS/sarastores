import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import QRCode from "qrcode"
import { requireAdmin } from "@/lib/auth"

const COLLECTION = "store_qr_codes"
const STORES_COLLECTION = "store_locations"

const QR_TYPES = [
  { type: "google_maps" as const, getTargetUrl: (store: any) => store.googleMapLocation || "" },
  { type: "whatsapp" as const, getTargetUrl: () => "https://whatsapp.com/channel/0029Va6Q9GO35fLwtGQiLr0u" },
  { type: "instagram" as const, getTargetUrl: () => "https://www.instagram.com/saramobilesandelectronics/" },
]

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const { storeIds } = body as { storeIds: string[] }

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "storeIds array is required" },
        { status: 400 }
      )
    }

    const storesCol = await getCollection(STORES_COLLECTION)
    const qrCol = await getCollection(COLLECTION)

    // Fetch requested stores
    const { ObjectId } = await import("mongodb")
    const objectIds = storeIds.map((id) => {
      try { return new ObjectId(id) } catch { return null }
    }).filter(Boolean)

    const stores = await storesCol.find({ _id: { $in: objectIds }, isActive: true }).toArray()

    if (stores.length === 0) {
      return NextResponse.json(
        { success: false, message: "No active stores found for the given IDs" },
        { status: 404 }
      )
    }

    // Find existing QR codes for these stores
    const storeIdStrings = stores.map((s) => s._id.toString())
    const existingQRs = await qrCol.find({ storeId: { $in: storeIdStrings } }).toArray()

    // Map existing QR types per store
    const existingMap = new Map<string, Set<string>>()
    for (const qr of existingQRs) {
      const sid = qr.storeId
      if (!existingMap.has(sid)) existingMap.set(sid, new Set())
      existingMap.get(sid)!.add(qr.type)
    }

    // Create missing QR codes for each store
    const created: any[] = []
    const skipped: { storeId: string; storeName: string; reason: string }[] = []

    for (const store of stores) {
      const sid = store._id.toString()
      const existingTypes = existingMap.get(sid) || new Set()

      for (const qrType of QR_TYPES) {
        if (existingTypes.has(qrType.type)) {
          skipped.push({
            storeId: sid,
            storeName: store.shopName || "",
            reason: `${qrType.type} already exists`,
          })
          continue
        }

        const targetUrl = qrType.getTargetUrl(store)
        if (!targetUrl) {
          skipped.push({
            storeId: sid,
            storeName: store.shopName || "",
            reason: `No URL configured for ${qrType.type}`,
          })
          continue
        }

        const scanUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://sarastores.com"}/api/store-qr/scan/pending`

        // We'll generate the real scan URL after insert
        const qrDataUrl = await QRCode.toDataURL(targetUrl, {
          width: 400,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
        })

        const qrDoc = {
          storeId: sid,
          storeName: store.shopName || "",
          type: qrType.type,
          label: "",
          targetUrl,
          qrDataUrl,
          scanCount: 0,
          lastScannedAt: null,
          scanHistory: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const result = await qrCol.insertOne(qrDoc)

        // Now update qrDataUrl to encode the real scan URL
        const realScanUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://sarastores.com"}/api/store-qr/scan/${result.insertedId.toString()}`
        const realQrDataUrl = await QRCode.toDataURL(realScanUrl, {
          width: 400,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
        })

        await qrCol.updateOne(
          { _id: result.insertedId },
          { $set: { qrDataUrl: realQrDataUrl, updatedAt: new Date() } }
        )

        created.push({
          id: result.insertedId.toString(),
          storeId: sid,
          storeName: store.shopName || "",
          type: qrType.type,
          targetUrl,
          scanUrl: realScanUrl,
          qrDataUrl: realQrDataUrl,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${created.length} QR codes, skipped ${skipped.length}`,
      created,
      skipped,
      summary: {
        storesProcessed: stores.length,
        totalCreated: created.length,
        totalSkipped: skipped.length,
      },
    })
  } catch (error) {
    console.error("Error in bulk QR generation:", error)
    return NextResponse.json(
      { success: false, message: "Failed to generate QR codes in bulk" },
      { status: 500 }
    )
  }
}
