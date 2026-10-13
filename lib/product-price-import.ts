import * as XLSX from "xlsx"
import type { ObjectId } from "mongodb"
import { getCollection } from "./db-service"
import { extractCanonicalProductMetadata } from "./product-schema"
import { priceSchema } from "./validation"

export const MAX_PRICE_IMPORT_BYTES = 10 * 1024 * 1024

export function googleSheetExportUrl(sheetId: string): string | null {
  if (/^[a-zA-Z0-9_-]+$/.test(sheetId)) return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
  let url: URL
  try { url = new URL(sheetId) } catch { return null }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password) return null
  if (/^\/spreadsheets\/d\/e\/[a-zA-Z0-9_-]+\/pub$/.test(url.pathname)) {
    url.searchParams.set("output", "csv")
    url.hash = ""
    return url.toString()
  }
  const standardId = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]
  return standardId && standardId !== "e" ? `https://docs.google.com/spreadsheets/d/${standardId}/export?format=csv` : null
}

interface PriceProduct {
  _id?: ObjectId | string
  itemno?: string
  sku?: string
  name?: string
  price?: number
  mrp?: number | null
  updatedAt?: Date
}
interface PriceRow {
  sku: string
  rowNumber: number
  price: number | null
  error: string
}
interface PricePreview {
  sku: string
  name: string
  mrp: number | null
  oldPrice: number | null
  newPrice: number
  status: "valid" | "error"
  error: string
}

export function readPriceSpreadsheet(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("Spreadsheet has no worksheet")
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  if (!rows.length) throw new Error("Spreadsheet is empty")
  if (rows.length > 50000) throw new Error("Spreadsheet exceeds 50,000 rows")
  return rows
}

function parseRows(data: Record<string, unknown>[]): { rows: PriceRow[]; ignoredDuplicates: number } {
  const bySku = new Map<string, PriceRow>()
  const missingSku: PriceRow[] = []
  let ignoredDuplicates = 0
  data.forEach((row, index) => {
    const sku = extractCanonicalProductMetadata(row).itemno.trim()
    const value = row.price ?? row.Price ?? row.PRICE
    const amount = typeof value === "string" ? Number(value.replace(/[₹,\s]/g, "")) : value
    const price = priceSchema.safeParse(amount)
    const parsed = {
      sku,
      rowNumber: index + 2,
      price: price.success ? price.data : null,
      error: !sku ? "Missing itemno" : value == null || value === "" ? "Missing price" : !price.success ? "Price must be a positive, finite number no greater than 10,000,000" : "",
    }
    if (!sku) missingSku.push(parsed)
    else {
      if (bySku.has(sku)) ignoredDuplicates++
      bySku.set(sku, parsed)
    }
  })
  return { rows: [...bySku.values(), ...missingSku], ignoredDuplicates }
}

export async function processProductPrices(data: Record<string, unknown>[], preview: boolean) {
  const { rows, ignoredDuplicates } = parseRows(data)
  const collection = await getCollection<PriceProduct>("products")
  const skus = rows.map(row => row.sku).filter(Boolean)
  const products = await collection.find({ $or: [{ itemno: { $in: skus } }, { sku: { $in: skus } }] }).toArray()
  const bySku = new Map(products.map(product => [product.itemno || product.sku, product]))
  const updates: PricePreview[] = []
  const errors: string[] = []
  let success = 0

  for (const row of rows) {
    const product = bySku.get(row.sku)
    let error = row.error
    if (!error && !product) error = "Product not found"
    if (!error && product && row.price !== null && product.mrp != null && row.price > product.mrp) error = "Price > MRP"
    if (!preview && !error && product && row.price !== null) {
      try {
        const result = await collection.findOneAndUpdate({
          _id: product._id,
          $or: [{ mrp: { $exists: false } }, { mrp: null }, { mrp: { $gte: row.price } }],
        }, {
          $set: { price: row.price, updatedAt: new Date() },
        }, { returnDocument: "after" })
        if (!result) error = "Product changed or price exceeds current MRP; preview again"
        else success++
      } catch (cause) {
        console.error("[Price Import] Product update failed", { row: row.rowNumber, cause })
        error = "Product update failed"
      }

    }
    if (error) errors.push(`Row ${row.rowNumber}: ${error}${row.sku ? ` for itemno ${row.sku}` : ""}`)
    updates.push({
      sku: row.sku,
      name: product?.name ?? "Unknown Product",
      mrp: product?.mrp ?? null,
      oldPrice: product?.price ?? null,
      newPrice: row.price ?? 0,
      status: error ? "error" : "valid",
      error,
    })
  }
  if (preview) return { preview: true, updates, ignoredDuplicates }
  return { success, failed: errors.length, errors, ignoredDuplicates, message: `Updated ${success} products, ${errors.length} failed` }
}

export async function processProductMrps(data: Record<string, unknown>[]) {
  const collection = await getCollection<PriceProduct>("products")
  const rows = new Map<string, { sku: string; amount: unknown }>()
  let skipped = 0
  const errors: Array<{ sku: string; error: string }> = []
  for (const row of data) {
    const sku = extractCanonicalProductMetadata(row).itemno.trim()
    const amount = ["MRP", "mrp", "M.R.P", "M R P", "mrp_value"].map(key => row[key])
      .find(value => value != null && String(value).trim() !== "")
    if (!sku || amount === undefined) { skipped++; continue }
    if (rows.has(sku.toLowerCase())) skipped++
    rows.set(sku.toLowerCase(), { sku, amount })
  }
  let updated = 0
  for (const { sku, amount } of rows.values()) {
    const parsed = priceSchema.safeParse(typeof amount === "string" ? Number(amount.replace(/[₹,\s]/g, "")) : amount)
    if (!parsed.success) {
      errors.push({ sku, error: "MRP must be a positive, finite amount no greater than 10,000,000" })
      continue
    }
    const literalSku = sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const matches = await collection.find({ itemno: { $regex: `^${literalSku}$`, $options: "i" } }).limit(2).toArray()
    if (!matches.length) { skipped++; continue }
    if (matches.length !== 1) {
      errors.push({ sku, error: "Multiple products match this itemno; reconcile before updating" })
      continue
    }
    const product = matches[0]
    if (product.price != null && (!Number.isFinite(product.price) || product.price < 0 || product.price > parsed.data)) {
      errors.push({ sku, error: "MRP is lower than the stored selling price or the selling price is invalid" })
      continue
    }
    const saved = await collection.findOneAndUpdate({
      _id: product._id,
      price: product.price === undefined ? { $exists: false } : product.price,
      mrp: product.mrp === undefined ? { $exists: false } : product.mrp,
    }, { $set: { mrp: parsed.data, updatedAt: new Date() } }, { returnDocument: "after" })
    if (!saved) errors.push({ sku, error: "Product changed before the MRP update; upload again" })
    else updated++
  }
  return { success: true, updated, skipped, errors }
}
