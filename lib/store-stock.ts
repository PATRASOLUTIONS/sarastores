import { ObjectId, type ClientSession } from "mongodb"
import { z } from "zod"
import { COLLECTIONS, getCollection } from "@/lib/db-service"

/**
 * Per-store stock, keyed by the store code from /admin/store-locations and the
 * product item code (`sku`). A product's customer-facing `stock` is the sum of
 * its rows here, recomputed after every upload.
 */
export const STORE_STOCK_COLLECTION = "store_stock"

export interface StoreStockRow {
  storeCode: string
  sku: string
  quantity: number
  updatedAt: Date
}

export const StoreStockUploadSchema = z.object({
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
}

/**
 * Ids of active stores holding every needed item in full. An item without an
 * item code cannot be held by any store, so it rules every store out; a store
 * without a store code has no stock and is never returned.
 */
export async function storesHoldingStock(needs: StockNeed[]): Promise<Set<string>> {
  const stores = await getCollection<{ _id: ObjectId; storeCode?: string }>("store_locations")
  const active = await stores.find(
    { isActive: { $ne: false }, storeCode: { $type: "string", $ne: "" } },
    { projection: { storeCode: 1 } },
  ).toArray()
  if (needs.length === 0) return new Set(active.map(store => store._id.toString()))
  if (needs.some(need => !need.sku)) return new Set()

  const required = new Map<string, number>()
  for (const need of needs) required.set(need.sku!, (required.get(need.sku!) ?? 0) + need.quantity)

  const rows = await (await getCollection<StoreStockRow>(STORE_STOCK_COLLECTION)).find(
    { sku: { $in: [...required.keys()] }, storeCode: { $in: active.map(store => store.storeCode!) } },
    { projection: { storeCode: 1, sku: 1, quantity: 1 } },
  ).toArray()
  const held = new Map(rows.map(row => [`${row.storeCode}\u0000${row.sku}`, Number(row.quantity) || 0]))

  return new Set(active
    .filter(store => [...required].every(([sku, quantity]) => (held.get(`${store.storeCode}\u0000${sku}`) ?? 0) >= quantity))
    .map(store => store._id.toString()))
}

/** Item codes for the given product ids, read from the catalogue. */
export async function itemCodesFor(productIds: string[]): Promise<Map<string, string | null>> {
  const objectIds = productIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
  const products = await (await getCollection<{ _id: ObjectId | string; id?: string; sku?: string }>(COLLECTIONS.PRODUCTS)).find(
    { $or: [{ _id: { $in: objectIds } }, { id: { $in: productIds } }] },
    { projection: { sku: 1, id: 1 } },
  ).toArray()
  const codes = new Map<string, string | null>(productIds.map(id => [id, null]))
  for (const product of products) {
    const sku = typeof product.sku === "string" && product.sku.trim() ? product.sku.trim() : null
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
  const now = new Date()
  const result = await (await getCollection(COLLECTIONS.PRODUCTS)).bulkWrite(skus.map(sku => ({
    updateMany: { filter: { sku }, update: { $set: { stock: bySku.get(sku) ?? 0, updatedAt: now } } },
  })), { session, ordered: false })
  return result.modifiedCount
}
