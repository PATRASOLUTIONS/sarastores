import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { handleApiError } from "@/lib/api-error"
import type { StoredStoreLocation } from "@/lib/store-locations"
import { stockCodeKey, stockItemAliases, stockItemCode, stockItemFilter, type StockCatalogueProduct } from "@/lib/stock-item-code"
import {
  recomputeProductStock, STORE_STOCK_COLLECTION, STOCK_WRITE_BATCH_SIZE, StoreStockUploadSchema, type StoreStockRow,
} from "@/lib/store-stock"

import { createStockPreview, STOCK_PREVIEW_PAGE_SIZE, type StockPreviewPlan, type SkippedStockRecord } from "@/lib/store-stock-preview"

const LIST_LIMIT = 20
export const maxDuration = 300
class StockPreviewChanged extends Error {}


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
      const product = await (await getCollection<StockCatalogueProduct & { name?: string; stock?: number }>(COLLECTIONS.PRODUCTS))
        .findOne(stockItemFilter([itemCode]), { collation: { locale: "en", strength: 2 } })
      const canonicalCode = product ? stockItemCode(product) || itemCode : itemCode
      const rows = await stock.find({ sku: canonicalCode }).sort({ storeCode: 1 }).toArray()
      return NextResponse.json({
        success: true,
        product: product ? { name: product.name || "", sku: canonicalCode, stock: Number(product.stock) || 0 } : null,
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

// POST - update listed item/store pairs; full-store replacement is explicit.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = StoreStockUploadSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    const { rows, replaceStores, preview, previewPage, previewToken } = parsed.data

    const storeCodes = [...new Set(rows.map(row => row.storeCode))]
    const itemCodes = [...new Set(rows.map(row => row.itemCode))]
    const [knownStores, products] = await Promise.all([
      (await getCollection<StoredStoreLocation>("store_locations")).find({ storeCode: { $in: storeCodes } },
        { projection: { storeCode: 1, shopName: 1 }, collation: { locale: "en", strength: 2 } }).toArray(),
      (await getCollection<StockCatalogueProduct & { _id: unknown }>(COLLECTIONS.PRODUCTS)).find(stockItemFilter(itemCodes),
        { projection: { sku: 1, itemno: 1, itemNo: 1, raw: 1 }, collation: { locale: "en", strength: 2 } }).toArray(),
    ])
    const storesByCode = new Map(knownStores.map(store => [stockCodeKey(store.storeCode!), store.storeCode!]))
    if (storesByCode.size !== knownStores.length) return NextResponse.json({ success: false, message: "Multiple stores share the same store code. Correct Store Locations before uploading." }, { status: 400 })
    const itemsByCode = new Map<string, string>()
    const owners = new Map<string, string>()
    for (const product of products) {
      const canonical = stockItemCode(product)
      if (!canonical) continue
      for (const alias of stockItemAliases(product)) {
        const key = stockCodeKey(alias)
        if (owners.has(key) && owners.get(key) !== String(product._id)) return NextResponse.json({ success: false, message: `Item No. ${alias} matches multiple products. Correct the catalogue before uploading.` }, { status: 400 })
        owners.set(key, String(product._id))
        itemsByCode.set(key, canonical)
      }
    }
    const unknownStores = storeCodes.filter(code => !storesByCode.has(stockCodeKey(code)))
    const unknownItems = itemCodes.filter(code => !itemsByCode.has(stockCodeKey(code)))
    const valid = rows.flatMap(row => {
      const storeCode = storesByCode.get(stockCodeKey(row.storeCode)), itemCode = itemsByCode.get(stockCodeKey(row.itemCode))
      return storeCode && itemCode ? [{ ...row, uploadedItemCode: row.itemCode, storeCode, itemCode }] : []
    })
    const resolvedPairs = new Set(valid.map(row => `${row.storeCode}\u0000${row.itemCode}`))
    if (resolvedPairs.size !== valid.length) return NextResponse.json({ success: false, message: "The same product is listed under multiple Item No./SKU aliases for one store. Keep one quantity per item and store." }, { status: 400 })
    const skippedRecords: SkippedStockRecord[] = rows.flatMap((row, index) => {
      const storeKnown = storesByCode.has(stockCodeKey(row.storeCode)), itemKnown = itemsByCode.has(stockCodeKey(row.itemCode))
      return storeKnown && itemKnown ? [] : [{ index, reason: !storeKnown && !itemKnown ? "Unknown Item No. and Store Code" : !storeKnown ? "Unknown Store Code" : "Unknown Item No." }]
    })
    const protectedStores = new Set(skippedRecords.flatMap(record => {
      const code = storesByCode.get(stockCodeKey(rows[record.index].storeCode))
      return code ? [code] : []
    }))
    const replacementStores = replaceStores ? [...new Set(valid.map(row => row.storeCode))].filter(code => !protectedStores.has(code)) : []
    const plan: StockPreviewPlan = { valid, replacementStores, skippedRecords,
      storeNames: new Map(knownStores.map(store => [store.storeCode!, store.shopName || store.storeCode!])),
      identities: [...knownStores.map(store => `store:${String(store._id)}:${store.storeCode}`), ...products.map(product => `product:${String(product._id)}:${stockItemCode(product)}`)],
    }
    const report = {
      unknownStores: unknownStores.slice(0, LIST_LIMIT), unknownStoreCount: unknownStores.length,
      unknownItems: unknownItems.slice(0, LIST_LIMIT), unknownItemCount: unknownItems.length,
      skippedRows: skippedRecords.length, skippedRecords,
      preservedStores: replaceStores ? [...protectedStores].slice(0, LIST_LIMIT) : [],
      preservedStoreCount: replaceStores ? protectedStores.size : 0,
    }
    const responsePreview = (snapshot: Awaited<ReturnType<typeof createStockPreview>>) => ({
      changes: snapshot.changes.slice(previewPage * STOCK_PREVIEW_PAGE_SIZE, (previewPage + 1) * STOCK_PREVIEW_PAGE_SIZE),
      totalChanges: snapshot.changes.length, previewPage, pageSize: STOCK_PREVIEW_PAGE_SIZE, previewToken: snapshot.previewToken,
    })
    if (preview || !valid.length) {
      const snapshot = await createStockPreview(plan)
      if (previewToken && previewToken !== snapshot.previewToken) throw new StockPreviewChanged()
      return NextResponse.json({ success: true, preview, saved: 0, stores: new Set(valid.map(row => row.storeCode)).size,
        validRows: valid.length, zeroedItems: snapshot.changes.filter(row => row.source === "omitted").length, productsUpdated: 0,
        ...responsePreview(snapshot), ...report })
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
        const snapshot = await createStockPreview(plan, session)
        if (previewToken && previewToken !== snapshot.previewToken) throw new StockPreviewChanged()
        for (let offset = 0; offset < snapshot.changes.length; offset += STOCK_WRITE_BATCH_SIZE) {
          await stock.bulkWrite(snapshot.changes.slice(offset, offset + STOCK_WRITE_BATCH_SIZE).map(row => ({
            updateOne: { filter: { storeCode: row.storeCode, sku: row.sku },
              update: { $set: { quantity: row.currentStoreStock, updatedAt: now } }, upsert: row.source === "upload" },
          })), { session, ordered: true })
        }
        const affected = [...new Set(snapshot.changes.map(row => row.sku))]
        const productsUpdated = await recomputeProductStock(affected, session)
        return { saved: valid.length, validRows: valid.length, stores: replacedStores.length, zeroedItems: snapshot.changes.filter(row => row.source === "omitted").length, productsUpdated, ...responsePreview(snapshot) }
      })
      if (!result) throw new Error("Store stock upload did not commit")
      return NextResponse.json({ success: true, preview: false, message: "Store stock updated", ...result, ...report })
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof StockPreviewChanged) return NextResponse.json({ success: false, message: "Stock or catalogue details changed since this preview. Refresh the preview before applying." }, { status: 409 })
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
    return handleApiError(error, "Failed to upload store stock; no rows were saved")
  }
}
