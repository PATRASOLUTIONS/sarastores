import { type ClientSession } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { scraperItemNumberKey } from "./bulk-import"

export function scraperItemNumberQuery(itemnos: string[]) {
  const matches = [...new Set(itemnos.map(scraperItemNumberKey))].map(value =>
    new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"),
  )
  return { $or: [{ itemno: { $in: matches } }, { sku: { $in: matches } }, { "raw.itemno": { $in: matches } }] }
}

/** Include inactive and legacy catalogue records; a scraper never replaces one. */
export async function existingScraperItemNumbers(itemnos: string[], session?: ClientSession): Promise<Set<string>> {
  if (!itemnos.length) return new Set()
  const wanted = new Set(itemnos.map(scraperItemNumberKey))
  const products = await (await getCollection("products")).find(scraperItemNumberQuery(itemnos), {
    projection: { itemno: 1, sku: 1, "raw.itemno": 1 }, session,
  }).toArray()
  const found = new Set<string>()
  for (const product of products) {
    for (const value of [product.itemno, product.sku, product.raw?.itemno]) {
      if (typeof value === "string" && wanted.has(scraperItemNumberKey(value))) found.add(scraperItemNumberKey(value))
    }
  }
  return found
}
