import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { handleApiError } from "@/lib/api-error"
import type { StoredStoreLocation } from "@/lib/store-locations"
import {
  recomputeProductStock, STORE_STOCK_COLLECTION, StoreStockUploadSchema, type StoreStockRow,
} from "@/lib/store-stock"

const LIST_LIMIT = 20

async function storeNames() {
  const stores = await (await getCollection<StoredStoreLocation>("store_locations"))
    .find({ storeCode: { $type: "string", $ne: "" } }, { projection: { storeCode: 1, shopName: 1, isActive: 1 } }).toArray()
  return new Map(stores.map(store => [store.storeCode!, { name: store.shopName || "", isActive: store.isActive !== false }]))
}

// GET - per-store summary, one item's stock across stores (?itemCode=), or every row (?export=1)
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const stock = await getCollection<StoreStockRow>(STORE_STOCK_COLLECTION)
    const names = await storeNames()
    const itemCode = searchParams.get("itemCode")?.trim()

    if (itemCode) {
      const [rows, product] = await Promise.all([
        stock.find({ sku: itemCode }).sort({ storeCode: 1 }).toArray(),
        (await getCollection<{ name?: string; stock?: number; sku?: string }>(COLLECTIONS.PRODUCTS))
          .findOne({ sku: itemCode }, { projection: { name: 1, stock: 1, sku: 1 } }),
      ])
      return NextResponse.json({
        success: true,
        product: product ? { name: product.name || "", sku: product.sku || itemCode, stock: Number(product.stock) || 0 } : null,
        rows: rows.map(row => ({
          storeCode: row.storeCode,
          storeName: names.get(row.storeCode)?.name || "Unknown store",
          quantity: row.quantity,
          updatedAt: row.updatedAt,
        })),
      })
    }

    if (searchParams.get("export") === "1") {
      const rows = await stock.find({}).sort({ storeCode: 1, sku: 1 }).toArray()
      return NextResponse.json({
        success: true,
        rows: rows.map(row => ({ itemCode: row.sku, storeCode: row.storeCode, storeName: names.get(row.storeCode)?.name || "", quantity: row.quantity })),
      })
    }

    const summary = await stock.aggregate<{ _id: string; items: number; units: number; inStock: number; updatedAt: Date }>([
      { $group: {
        _id: "$storeCode",
        items: { $sum: 1 },
        inStock: { $sum: { $cond: [{ $gt: ["$quantity", 0] }, 1, 0] } },
        units: { $sum: "$quantity" },
        updatedAt: { $max: "$updatedAt" },
      } },
      { $sort: { _id: 1 } },
    ]).toArray()
    const stores = [...names].map(([storeCode, store]) => {
      const held = summary.find(row => row._id === storeCode)
      return { storeCode, storeName: store.name, isActive: store.isActive, items: held?.items ?? 0, inStock: held?.inStock ?? 0, units: held?.units ?? 0, updatedAt: held?.updatedAt ?? null }
    })
    return NextResponse.json({ success: true, stores, listLimit: LIST_LIMIT })
  } catch (error) {
    return handleApiError(error, "Failed to load store stock")
  }
}

// POST - upload a stock sheet. Each store in the sheet is replaced in full:
// its items missing from the sheet are set to 0.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = StoreStockUploadSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    const { rows } = parsed.data

    const seen = new Set<string>()
    const duplicates = rows.filter(row => {
      const key = `${row.storeCode}\u0000${row.itemCode}`
      if (seen.has(key)) return true
      seen.add(key)
      return false
    })
    if (duplicates.length) {
      const sample = duplicates.slice(0, 5).map(row => `${row.itemCode} @ ${row.storeCode}`).join(", ")
      return NextResponse.json({ success: false, message: `The same item appears more than once for a store: ${sample}` }, { status: 400 })
    }

    const storeCodes = [...new Set(rows.map(row => row.storeCode))]
    const itemCodes = [...new Set(rows.map(row => row.itemCode))]
    const [knownStores, knownItems] = await Promise.all([
      (await getCollection<StoredStoreLocation>("store_locations")).distinct("storeCode", { storeCode: { $in: storeCodes } }),
      (await getCollection<{ sku?: string }>(COLLECTIONS.PRODUCTS)).distinct("sku", { sku: { $in: itemCodes } }),
    ])
    const storeSet = new Set(knownStores.map(String))
    const itemSet = new Set(knownItems.map(String))
    const unknownStores = storeCodes.filter(code => !storeSet.has(code))
    const unknownItems = itemCodes.filter(code => !itemSet.has(code))
    const valid = rows.filter(row => storeSet.has(row.storeCode) && itemSet.has(row.itemCode))
    const report = {
      unknownStores: unknownStores.slice(0, LIST_LIMIT), unknownStoreCount: unknownStores.length,
      unknownItems: unknownItems.slice(0, LIST_LIMIT), unknownItemCount: unknownItems.length,
      skippedRows: rows.length - valid.length,
    }
    if (unknownStores.length || unknownItems.length) {
      return NextResponse.json({ success: false, message: "Unknown item or store codes found. Correct them and upload again; no stock was changed.", ...report }, { status: 400 })
    }
    if (valid.length === 0) {
      return NextResponse.json({ success: false, message: "No row matched a known store code and item code; nothing was saved", ...report }, { status: 400 })
    }

    const stock = await getCollection<StoreStockRow>(STORE_STOCK_COLLECTION)
    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      const result = await session.withTransaction(async () => {
        const now = new Date()
        const replacedStores = [...new Set(valid.map(row => row.storeCode))]
        // Serialize full replacements of the same store, even when two
        // uploads contain disjoint item codes and no stock rows yet exist.
        const locations = await getCollection<StoredStoreLocation>("store_locations")
        const claimed = await locations.updateMany({ storeCode: { $in: replacedStores } },
          { $inc: { stockRevision: 1 } }, { session })
        if (claimed.matchedCount < replacedStores.length) throw new Error("A store changed during upload; retry the sheet")
        const skusByStore = new Map<string, string[]>()
        for (const row of valid) skusByStore.set(row.storeCode, [...(skusByStore.get(row.storeCode) ?? []), row.itemCode])

        const zeroedSkus = await stock.distinct("sku", {
          $or: replacedStores.map(storeCode => ({ storeCode, sku: { $nin: skusByStore.get(storeCode)! }, quantity: { $gt: 0 } })),
        }, { session })

        await stock.bulkWrite([
          ...valid.map(row => ({
            updateOne: {
              filter: { storeCode: row.storeCode, sku: row.itemCode },
              update: { $set: { quantity: row.quantity, updatedAt: now } },
              upsert: true,
            },
          })),
          ...replacedStores.map(storeCode => ({
            updateMany: {
              filter: { storeCode, sku: { $nin: skusByStore.get(storeCode)! }, quantity: { $gt: 0 } },
              update: { $set: { quantity: 0, updatedAt: now } },
            },
          })),
        ], { session, ordered: true })

        const affected = [...new Set([...valid.map(row => row.itemCode), ...zeroedSkus.map(String)])]
        const productsUpdated = await recomputeProductStock(affected, session)
        return { saved: valid.length, stores: replacedStores.length, zeroedItems: zeroedSkus.length, productsUpdated }
      })
      if (!result) throw new Error("Store stock upload did not commit")
      return NextResponse.json({ success: true, message: "Store stock updated", ...result, ...report })
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
    return handleApiError(error, "Failed to upload store stock; no rows were saved")
  }
}
