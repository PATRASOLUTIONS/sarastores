import { ObjectId, type ClientSession } from "mongodb"
import { z } from "zod"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { ACTIVE_RETAIL_STORE_FILTER } from "@/lib/store-locations"
import { stockItemCode, stockItemFilter, type StockCatalogueProduct } from "@/lib/stock-item-code"

/**
 * Per-store stock, keyed by the store code from /admin/store-locations and the
 * product item code (`sku`). A product's customer-facing `stock` is the sum of
 * its rows here, recomputed after every upload.
 */
export const STORE_STOCK_COLLECTION = "store_stock"
export const STOCK_WRITE_BATCH_SIZE = 500

export interface StoreStockRow {
  storeCode: string
  sku: string
  quantity: number
  updatedAt: Date
}

export const StoreStockUploadSchema = z.object({
  replaceStores: z.boolean().default(false),
  preview: z.boolean().default(false),
  previewPage: z.number().int().min(0).max(10000).default(0),
  previewToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  rows: z.array(z.object({
    itemCode: z.string().trim().min(1, "Every row needs an item code").max(100),
    storeCode: z.string().trim().min(1, "Every row needs a store code").max(50),
    quantity: z.number().int("Quantity must be a whole number").min(0, "Quantity cannot be negative").max(1_000_000),
  }).strict()).min(1, "The sheet has no rows").max(50_000, "Upload at most 50,000 rows at a time"),
}).strict()

export type StoreStockUploadRow = z.infer<typeof StoreStockUploadSchema>["rows"][number]

/** Distance beyond which checkout suggests ordering online instead of a store. */
export function storeFarDistanceKm(): number {
  const value = Number(process.env.STORE_PICKUP_FAR_KM)
  return Number.isFinite(value) && value > 0 ? value : 15
}

export interface StockNeed {
  sku: string | null
  quantity: number
  /** Catalogue Item No. shown to shoppers when it differs from the stock SKU. */
  itemCode?: string | null
}

/**
 * Ids of active stores holding every needed item in full. An item without an
 * item code cannot be held by any store, so it rules every store out; a store
 * without a store code has no stock and is never returned.
 */
export interface StoreItemAvailability {
  itemCode: string
  required: number
  available: number
}

export async function getStoreStockAvailability(needs: StockNeed[], session?: ClientSession) {
  const stores = await getCollection<{ _id: ObjectId; storeCode?: string }>("store_locations")
  const active = await stores.find(
    ACTIVE_RETAIL_STORE_FILTER,
    { projection: { storeCode: 1 }, session },
  ).toArray()

  const required = new Map<string, number>()
  const displayCodes = new Map<string, string>()
  for (const need of needs) if (need.sku) required.set(need.sku, (required.get(need.sku) ?? 0) + need.quantity)
  for (const need of needs) if (need.sku && need.itemCode) displayCodes.set(need.sku, need.itemCode)

  const rows = required.size ? await (await getCollection<StoreStockRow>(STORE_STOCK_COLLECTION)).find(
    { sku: { $in: [...required.keys()] }, storeCode: { $in: active.flatMap(store => store.storeCode?.trim() ? [store.storeCode.trim()] : []) } },
    { projection: { storeCode: 1, sku: 1, quantity: 1 }, session },
  ).toArray() : []
  const held = new Map(rows.map(row => [`${row.storeCode}\u0000${row.sku}`,
    Number.isSafeInteger(row.quantity) && row.quantity >= 0 ? row.quantity : 0]))
  const byStore: Record<string, StoreItemAvailability[]> = {}
  const storeIds = new Set<string>()
  for (const store of active) {
    const id = store._id.toString()
    const code = store.storeCode?.trim()
    const details = [...required].map(([sku, quantity]) => ({
      itemCode: displayCodes.get(sku) || sku, required: quantity, available: code ? held.get(`${code}\u0000${sku}`) ?? 0 : 0,
    }))
    byStore[id] = details
    if (!needs.some(need => !need.sku) && (needs.length === 0 || Boolean(code)) &&
      details.every(item => item.available >= item.required)) storeIds.add(id)
  }
  return { storeIds, byStore }
}

export async function storesHoldingStock(needs: StockNeed[], session?: ClientSession): Promise<Set<string>> {
  return (await getStoreStockAvailability(needs, session)).storeIds
}

/** Item codes for the given product ids, read from the catalogue. */
export async function itemCodesFor(productIds: string[]): Promise<Map<string, string | null>> {
  const objectIds = productIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
  const products = await (await getCollection<StockCatalogueProduct & { _id: ObjectId | string; id?: string }>(COLLECTIONS.PRODUCTS)).find(
    { $or: [{ _id: { $in: objectIds } }, { _id: { $in: productIds } }, { id: { $in: productIds } }] },
    { projection: { sku: 1, itemno: 1, itemNo: 1, raw: 1, id: 1 } },
  ).toArray()
  const codes = new Map<string, string | null>(productIds.map(id => [id, null]))
  for (const product of products) {
    const sku = stockItemCode(product)
    codes.set(product._id.toString(), sku)
    if (product.id) codes.set(product.id, sku)
  }
  return codes
}

/** Sets each product's `stock` to the total held across all stores. */
export async function recomputeProductStock(skus: string[], session?: ClientSession): Promise<number> {
  if (skus.length === 0) return 0
  const totals = await (await getCollection<StoreStockRow>(STORE_STOCK_COLLECTION)).aggregate<{ _id: string; total: number }>([
    { $match: { sku: { $in: skus } } },
    { $group: { _id: "$sku", total: { $sum: "$quantity" } } },
  ], { session }).toArray()
  const bySku = new Map(totals.map(row => [row._id, row.total]))
  const requested = new Set(skus.map(code => code.trim().toUpperCase()))
  const products = await (await getCollection<StockCatalogueProduct & { _id: ObjectId | string }>(COLLECTIONS.PRODUCTS)).find(
    stockItemFilter(skus), { projection: { sku: 1, itemno: 1, itemNo: 1, raw: 1 }, session, collation: { locale: "en", strength: 2 } },
  ).toArray()
  const updates = products.filter(product => requested.has(stockItemCode(product)?.toUpperCase() || ""))
  if (!updates.length) return 0
  const now = new Date()
  const collection = await getCollection<StockCatalogueProduct & { _id: ObjectId | string; stock?: number; updatedAt?: Date }>(COLLECTIONS.PRODUCTS)
  let modifiedCount = 0
  for (let offset = 0; offset < updates.length; offset += STOCK_WRITE_BATCH_SIZE) {
    const result = await collection.bulkWrite(updates.slice(offset, offset + STOCK_WRITE_BATCH_SIZE).map(product => ({
      updateOne: { filter: { _id: product._id }, update: { $set: { stock: bySku.get(stockItemCode(product)!) ?? 0, updatedAt: now } } },
    })), { session, ordered: false })
    modifiedCount += result.modifiedCount
  }
  return modifiedCount
}
