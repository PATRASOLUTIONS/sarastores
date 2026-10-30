import { createHash } from "node:crypto"
import type { ClientSession, ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { stockItemCode, type StockCatalogueProduct } from "@/lib/stock-item-code"
import { findStockProducts, findStockRows } from "@/lib/store-stock-catalogue"
import { STORE_STOCK_COLLECTION, type StoreStockRow, type StoreStockUploadRow } from "@/lib/store-stock"

export const STOCK_PREVIEW_PAGE_SIZE = 200
export interface StockChange {
  itemCode: string; sku: string; productName: string; storeCode: string; storeName: string
  previousOverallStock: number; currentOverallStock: number; previousStoreStock: number; currentStoreStock: number
  source: "upload" | "omitted"
}
export interface SkippedStockRecord { index: number; reason: string }
export interface StockPreviewPlan {
  valid: (StoreStockUploadRow & { uploadedItemCode: string })[]
  replacementStores: string[]
  storeNames: Map<string, string>
  skippedRecords: SkippedStockRecord[]
  identities: string[]
}
const pairKey = (storeCode: string, sku: string) => `${storeCode}\u0000${sku}`
export async function createStockPreview(plan: StockPreviewPlan, session?: ClientSession) {
  const stock = await getCollection<StoreStockRow>(STORE_STOCK_COLLECTION)
  const listed = new Set(plan.valid.map(row => pairKey(row.storeCode, row.itemCode)))
  const omitted = plan.replacementStores.length ? (await stock.find({ storeCode: { $in: plan.replacementStores }, quantity: { $gt: 0 } }, { session }).toArray())
    .filter(row => !listed.has(pairKey(row.storeCode, row.sku))) : []
  const skus = [...new Set([...plan.valid.map(row => row.itemCode), ...omitted.map(row => row.sku)])]
  const rows = await findStockRows<StoreStockRow>(STORE_STOCK_COLLECTION, skus, session)
  const previousPairs = new Map(rows.map(row => [pairKey(row.storeCode, row.sku), row.quantity]))
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.sku, (totals.get(row.sku) || 0) + row.quantity)
  const products = await findStockProducts<StockCatalogueProduct & { _id: ObjectId | string; name?: string; stock?: number }>(skus,
    { session, projection: { sku: 1, itemno: 1, itemNo: 1, raw: 1, name: 1, stock: 1 } })
  const bySku = new Map(products.map(product => [stockItemCode(product), product]))
  if (plan.valid.some(row => !bySku.has(row.itemCode))) throw new Error("An item changed in the catalogue. Refresh the stock preview.")
  const edits = [
    ...plan.valid.map(row => ({ itemCode: row.uploadedItemCode, sku: row.itemCode, storeCode: row.storeCode, quantity: row.quantity, source: "upload" as const })),
    ...omitted.map(row => ({ itemCode: row.sku, sku: row.sku, storeCode: row.storeCode, quantity: 0, source: "omitted" as const })),
  ]
  const nextTotals = new Map(totals)
  for (const row of edits) nextTotals.set(row.sku, (nextTotals.get(row.sku) || 0) - (previousPairs.get(pairKey(row.storeCode, row.sku)) || 0) + row.quantity)
  const changes: StockChange[] = edits.map(row => {
    const product = bySku.get(row.sku)
    const previousOverall = product?.stock
    return { itemCode: row.itemCode, sku: row.sku, productName: product?.name || "", storeCode: row.storeCode,
      storeName: plan.storeNames.get(row.storeCode) || row.storeCode,
      previousOverallStock: typeof previousOverall === "number" && Number.isSafeInteger(previousOverall) && previousOverall >= 0 ? previousOverall : totals.get(row.sku) || 0,
      currentOverallStock: nextTotals.get(row.sku) || 0,
      previousStoreStock: previousPairs.get(pairKey(row.storeCode, row.sku)) || 0, currentStoreStock: row.quantity, source: row.source }
  }).sort((a, b) => a.sku.localeCompare(b.sku) || a.storeCode.localeCompare(b.storeCode))
  const previewToken = createHash("sha256").update(JSON.stringify({ changes, skippedRecords: plan.skippedRecords,
    identities: [...plan.identities, ...products.map(product => `${String(product._id)}:${stockItemCode(product)}`)].sort(), replacementStores: [...plan.replacementStores].sort() })).digest("hex")
  return { changes, previewToken }
}
