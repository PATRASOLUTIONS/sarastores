import type { ClientSession, Document, Filter, FindOptions, WithId } from "mongodb"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { stockItemFilter, type StockCatalogueProduct } from "@/lib/stock-item-code"
import type { StoreStockRow } from "@/lib/store-stock"

export const STOCK_LOOKUP_BATCH_SIZE = 500

/** Avoid oversized MongoDB queries when a master sheet has many unknown codes. */
export async function findStockProducts<T extends Document & StockCatalogueProduct>(codes: string[], options: FindOptions<T> = {}) {
  const collection = await getCollection<T>(COLLECTIONS.PRODUCTS)
  const found = new Map<string, WithId<T>>()
  const unique = [...new Set(codes)]
  for (let offset = 0; offset < unique.length; offset += STOCK_LOOKUP_BATCH_SIZE) {
    const products = await collection.find(stockItemFilter(unique.slice(offset, offset + STOCK_LOOKUP_BATCH_SIZE)) as Filter<T>, {
      collation: { locale: "en", strength: 2 }, ...options,
    }).toArray()
    for (const product of products) found.set(String(product._id), product)
  }
  return [...found.values()]
}

export async function findStockRows(collectionName: string, skus: string[], session?: ClientSession) {
  const collection = await getCollection<StoreStockRow>(collectionName)
  const rows: WithId<StoreStockRow>[] = []
  const unique = [...new Set(skus)]
  for (let offset = 0; offset < unique.length; offset += STOCK_LOOKUP_BATCH_SIZE) {
    rows.push(...await collection.find({ sku: { $in: unique.slice(offset, offset + STOCK_LOOKUP_BATCH_SIZE) } }, { session }).toArray())
  }
  return rows
}
