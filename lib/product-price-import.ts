import * as XLSX from "xlsx"
import { MongoBulkWriteError, type AnyBulkWriteOperation, type ObjectId } from "mongodb"
import { getCollection } from "./db-service"
import { extractCanonicalProductMetadata } from "./product-schema"
import { priceSchema } from "./validation"
import { stockCodeKey, stockItemAliases, stockItemFilter } from "./stock-item-code"

export const MAX_PRICE_IMPORT_BYTES = 10 * 1024 * 1024
export const PRICE_IMPORT_BATCH_SIZE = 500

export function googleSheetExportUrl(sheetId: string): string | null {
  if (/^[a-zA-Z0-9_-]+$/.test(sheetId)) return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
  let url: URL
  try { url = new URL(sheetId) } catch { return null }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password) return null
  if (/^\/spreadsheets\/d\/e\/[a-zA-Z0-9_-]+\/pub$/.test(url.pathname)) {
    url.searchParams.set("output", "csv")
    const gid = url.searchParams.get("gid") ?? new URLSearchParams(url.hash.slice(1)).get("gid")
    if (gid !== null && !/^\d+$/.test(gid)) return null
    if (gid !== null) url.searchParams.set("gid", gid)
    url.hash = ""
    return url.toString()
  }
  const standardId = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]
  if (!standardId || standardId === "e") return null
  const gid = url.searchParams.get("gid") ?? new URLSearchParams(url.hash.slice(1)).get("gid")
  if (gid !== null && !/^\d+$/.test(gid)) return null
  return `https://docs.google.com/spreadsheets/d/${standardId}/export?format=csv${gid !== null ? `&gid=${gid}` : ""}`
}

function allowedDownloadUrl(url: URL): boolean {
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    (url.hostname === "docs.google.com" || url.hostname === "drive.google.com" || url.hostname.endsWith(".googleusercontent.com"))
}

export async function fetchGoogleSheet(url: string): Promise<Response> {
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "manual", cache: "no-store" })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get("location")
    await response.body?.cancel()
    if (!location) throw new Error("Google Sheet redirect has no destination")
    const next = new URL(location, url)
    if (!allowedDownloadUrl(next)) throw new Error("Google Sheet redirected outside the allowed download hosts")
    url = next.toString()
  }
  throw new Error("Google Sheet exceeded the redirect limit")
}

export async function readBoundedSheet(response: Response): Promise<ArrayBuffer> {
  if (Number(response.headers.get("content-length")) > MAX_PRICE_IMPORT_BYTES) {
    await response.body?.cancel()
    throw new Error("Google Sheet exceeds 10 MB")
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Google Sheet has no response body")
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_PRICE_IMPORT_BYTES) {
        await reader.cancel()
        throw new Error("Google Sheet exceeds 10 MB")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const buffer = new ArrayBuffer(length)
  const bytes = new Uint8Array(buffer)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return buffer
}

interface PriceProduct {
  _id?: ObjectId | string
  itemno?: string
  sku?: string
  itemNo?: string | number
  raw?: Record<string, unknown>
  name?: string
  price?: number
  mrp?: number | null
  updatedAt?: Date
}
interface PriceRow {
  sku: string
  rowNumber: number
  price: number | null
  mrp?: number
  error: string
}
interface PricePreview {
  sku: string
  name: string
  mrp: number | null
  oldPrice: number | null
  newPrice: number
  newMrp: number | null
  status: "valid" | "error"
  error: string
}

export function readPriceSpreadsheet(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", raw: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("Spreadsheet has no worksheet")
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false })
  if (!rows.length) throw new Error("Spreadsheet is empty")
  if (rows.length > 50000) throw new Error("Spreadsheet exceeds 50,000 rows")
  return rows
}

function parseRows(data: Record<string, unknown>[]): { rows: PriceRow[]; ignoredDuplicates: number } {
  // Ignore legacy stock columns; /admin/stock-check maintains inventory.
  const bySku = new Map<string, PriceRow>()
  const missingSku: PriceRow[] = []
  let ignoredDuplicates = 0
  data.forEach((row, index) => {
    const sku = extractCanonicalProductMetadata(row).itemno.trim()
    const value = row.price ?? row.Price ?? row.PRICE
    const amount = typeof value === "string" ? Number(value.replace(/[₹,\s]/g, "")) : value
    const price = priceSchema.safeParse(amount)
    const mrpValue = row.mrp ?? row.MRP ?? row.Mrp
    const supplied = (value: unknown) => value != null && String(value).trim() !== ""
    const numeric = (value: unknown) => typeof value === "string" ? Number(value.replace(/[₹,\s]/g, "")) : value
    const mrp = supplied(mrpValue) ? priceSchema.safeParse(numeric(mrpValue)) : undefined
    const parsed = {
      sku,
      rowNumber: index + 2,
      price: price.success ? price.data : null,
      mrp: mrp?.success ? mrp.data : undefined,
      error: !sku ? "Missing itemno" : !supplied(value) ? "Missing price" : !price.success ? "Price must be a positive, finite number no greater than 10,000,000"
        : mrp && !mrp.success ? "MRP must be a positive, finite number no greater than 10,000,000"
        : "",
    }
    if (!sku) missingSku.push(parsed)
    else {
      if (bySku.has(stockCodeKey(sku))) ignoredDuplicates++
      bySku.set(stockCodeKey(sku), parsed)
    }
  })
  return { rows: [...bySku.values(), ...missingSku], ignoredDuplicates }
}

export async function processProductPrices(data: Record<string, unknown>[], preview: boolean) {
  const { rows, ignoredDuplicates } = parseRows(data)
  const collection = await getCollection<PriceProduct>("products")
  const skus = rows.map(row => row.sku).filter(Boolean)
  const bySku = new Map<string, PriceProduct[]>()
  for (let offset = 0; offset < skus.length; offset += PRICE_IMPORT_BATCH_SIZE) {
    const products = await collection.find(stockItemFilter(skus.slice(offset, offset + PRICE_IMPORT_BATCH_SIZE)), {
      projection: { itemno: 1, sku: 1, itemNo: 1, raw: 1, name: 1, price: 1, mrp: 1 },
      collation: { locale: "en", strength: 2 },
    }).toArray()
    for (const product of products) {
      for (const key of new Set(stockItemAliases(product).map(stockCodeKey))) {
        const matches = bySku.get(key) ?? []
        if (!matches.some(match => String(match._id) === String(product._id))) matches.push(product)
        bySku.set(key, matches)
      }
    }
  }
  const updates: PricePreview[] = []
  const errors: string[] = []
  let success = 0
  let writeFailures = 0
  const operations: AnyBulkWriteOperation<PriceProduct>[] = []
  const queuedProducts = new Set<string>()

  for (const row of rows) {
    const matches = bySku.get(stockCodeKey(row.sku)) ?? []
    const product = matches[0]
    const effectiveMrp = row.mrp ?? product?.mrp
    let error = row.error
    if (!error && !product) error = "Product not found"
    if (!error && matches.length > 1) error = "Multiple products match this itemno; reconcile before updating"
    if (!error && effectiveMrp != null && (!Number.isFinite(effectiveMrp) || effectiveMrp < 0)) error = "Stored MRP is invalid"
    if (!error && row.price !== null && effectiveMrp != null && row.price > effectiveMrp) error = "Price > MRP"
    if (!error && product && queuedProducts.has(String(product._id))) error = "Another row matches the same product through a different item number"
    if (!error && product) queuedProducts.add(String(product._id))
    if (!preview && !error && product && row.price !== null) {
      operations.push({ updateOne: { filter: {
          _id: product._id,
          price: product.price === undefined ? { $exists: false } : product.price,
          mrp: product.mrp === undefined ? { $exists: false } : product.mrp,
          ...(row.mrp === undefined ? { $or: [{ mrp: { $exists: false } }, { mrp: null }, { mrp: { $gte: row.price } }] } : {}),
        }, update: {
          $set: {
            price: row.price,
            ...(row.mrp !== undefined ? { mrp: row.mrp } : {}),
            updatedAt: new Date(),
          },
        }, upsert: false } })
    }
    if (error) errors.push(`Row ${row.rowNumber}: ${error}${row.sku ? ` for itemno ${row.sku}` : ""}`)
    updates.push({
      sku: row.sku,
      name: product?.name ?? "Unknown Product",
      mrp: product?.mrp ?? null,
      oldPrice: product?.price ?? null,
      newPrice: row.price ?? 0,
      newMrp: effectiveMrp ?? null,
      status: error ? "error" : "valid",
      error,
    })
  }
  if (preview) return { preview: true, updates, ignoredDuplicates }
  for (let offset = 0; offset < operations.length; offset += PRICE_IMPORT_BATCH_SIZE) {
    const batch = operations.slice(offset, offset + PRICE_IMPORT_BATCH_SIZE)
    try {
      const result = await collection.bulkWrite(batch, { ordered: false })
      success += result.matchedCount
      const conflicts = batch.length - result.matchedCount
      writeFailures += conflicts
      if (conflicts) errors.push(`${conflicts} products changed before updating; preview again (batch ${offset / PRICE_IMPORT_BATCH_SIZE + 1})`)
    } catch (cause) {
      // Unordered writes may partly succeed; include acknowledged matches only.
      const matched = cause instanceof MongoBulkWriteError ? cause.result.matchedCount : 0
      success += matched
      writeFailures += batch.length - matched
      errors.push(`Could not confirm ${batch.length - matched} updates in batch ${offset / PRICE_IMPORT_BATCH_SIZE + 1}; preview again`)
      console.error("[Price Import] Batch update failed", { offset, cause })
    }
  }
  const failed = updates.filter(update => update.status === "error").length + writeFailures
  return { success, failed, errors, ignoredDuplicates, message: `Updated ${success} products, ${failed} failed` }
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
