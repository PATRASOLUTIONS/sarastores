import { NextRequest, NextResponse } from "next/server"
import { MongoServerError } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import { BulkStoreLocationSchema } from "@/lib/validation"
import type { StoredStoreLocation } from "@/lib/store-locations"

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = BulkStoreLocationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    const collection = await getCollection<StoredStoreLocation>("store_locations")
    const codeOwners = new Map(parsed.data.stores.flatMap(store => store.storeCode ? [[store.storeCode, store.shopName] as const] : []))
    if (codeOwners.size) {
      const clash = (await collection.find({ storeCode: { $in: [...codeOwners.keys()] } }, { projection: { storeCode: 1, shopName: 1 } }).toArray())
        .find(existing => existing.storeCode && codeOwners.get(existing.storeCode) !== existing.shopName)
      if (clash) return NextResponse.json({ success: false, message: `Store code ${clash.storeCode} already belongs to ${clash.shopName}` }, { status: 409 })
    }
    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      const result = await session.withTransaction(async () => {
        const now = new Date()
        const saved = await collection.bulkWrite(parsed.data.stores.map(store => ({
          updateOne: {
            filter: { shopName: store.shopName },
            update: { $set: { ...store, updatedAt: now }, $setOnInsert: { createdAt: now, ...(!store.locationType ? { locationType: "store" } : {}) } },
            upsert: true,
          },
        })), { session, ordered: true })
        if (saved.matchedCount + saved.upsertedCount !== parsed.data.stores.length) throw new Error("Store upload did not acknowledge every row")
        return { success: true, message: "Bulk upload committed", inserted: saved.upsertedCount, updated: saved.matchedCount }
      })
      if (!result) throw new Error("Store upload transaction did not commit")
      return NextResponse.json(result)
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
    if (error instanceof MongoServerError && error.code === 11000) return NextResponse.json({ success: false, message: "Store name conflicted with another request; reload and retry" }, { status: 409 })
    console.error("Error in bulk store upload:", error)
    return NextResponse.json({ success: false, message: "Failed to process bulk upload; no rows committed" }, { status: 500 })
  }
}
