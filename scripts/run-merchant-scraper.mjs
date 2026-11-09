import fs from "node:fs/promises"
import path from "node:path"
import XLSX from "xlsx"
import { MongoClient } from "mongodb"
import { sourceLoader } from "../tests/source-loader.mjs"
import { localCacheWriter } from "../lib/scrapers/local-cache.mjs"

// Owner-operated runner. Default stores successful extractions locally; --store also saves
// the dedicated enrichment cache. Never updates products/specifications or Google.
const args = process.argv.slice(2), store = args.includes("--store"), probe = args.includes("--probe")
const files = args.filter(argument => !argument.startsWith("--"))
const selected = new Set((args.find(argument => argument.startsWith("--items="))?.slice(8) || "").split(",").filter(Boolean).map(value => value.trim().toUpperCase()))
if (!files.length) throw new Error("Provide Excel paths, optionally --probe or --store")
const directory = path.resolve(".seo-local/merchant-scraper")
await fs.mkdir(directory, { recursive: true })
let client
const loader = sourceLoader({ "@/lib/db-service": { getCollection: async name => {
  if (!client) throw new Error("Database cache unavailable in local-only run")
  return client.db(process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise").collection(name)
} } })
const { detectSource } = loader.load("lib/scrapers/http.ts")
const { scraperRowValues, sheetCellLink, scraperColumnField, validateScraperRows, scraperItemNumberKey } = loader.load("lib/scrapers/bulk-import.ts")
const { extractMerchantEnrichment, storeMerchantEnrichment } = loader.load("lib/scrapers/merchant-enrichment.ts")
const all = []
for (const filename of files) {
  const book = XLSX.read(await fs.readFile(filename), { type: "buffer", cellFormula: true, sheetRows: 502 })
  const sheet = book.Sheets[book.SheetNames[0]]
  if (sheet["!fullref"]) throw new Error("Workbook exceeds 500 rows")
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false })
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1")
  for (const row of rows) for (let c = range.s.c; c <= range.e.c; c++) {
    const header = String(sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v || "")
    if (scraperColumnField(header) !== "url") continue
    const target = sheetCellLink(sheet[XLSX.utils.encode_cell({ r: row.__rowNum__, c })])
    if (target) row[header] = target
  }
  const validation = validateScraperRows(rows, url => !!detectSource(url))
  if (validation.error || validation.issues.length) throw new Error(`Invalid workbook: ${path.basename(filename)}; ${validation.error || validation.issues.length + " row issues"}`)
  for (const row of rows) all.push({ ...scraperRowValues(row), file: path.basename(filename) })
}
console.log(JSON.stringify({ stage: "validated", rows: all.length,
  sources: Object.fromEntries([...new Set(all.map(row => detectSource(row.url)))].map(source => [source, all.filter(row => detectSource(row.url) === source).length])) }))
if (selected.size && !all.some(row => selected.has(scraperItemNumberKey(row.itemno)))) throw new Error("Requested item numbers were not found in these workbooks")
const localCachePath = path.join(directory, "cache.json")
const cache = JSON.parse(await fs.readFile(localCachePath, "utf8").catch(() => "{}"))
const results = [], sourceFailures = new Map(), seen = new Set(), sampled = new Set()
const saveCache = localCacheWriter(localCachePath)
try {
  if (store) {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for --store")
    client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 3, serverSelectionTimeoutMS: 12000, socketTimeoutMS: 45000 })
    await client.connect()
  }
  // Sequential per host, at most two different hosts in flight. Blocked hosts open a circuit.
  const groups = new Map()
  for (const row of all) {
    const key = scraperItemNumberKey(row.itemno), source = detectSource(row.url)
    if (selected.size && !selected.has(key)) continue
    if (seen.has(key)) { results.push({ itemno: key, file: row.file, status: "duplicate", source }); continue }
    seen.add(key)
    if (probe && sampled.has(source)) continue
    sampled.add(source)
    if (!groups.has(source)) groups.set(source, [])
    groups.get(source).push(row)
  }
  const queues = [...groups.entries()]
  let queueIndex = 0
  const worker = async () => {
    while (queueIndex < queues.length) {
      const [source, rows] = queues[queueIndex++]
      for (const row of rows) {
        const key = scraperItemNumberKey(row.itemno)
        let fetchedPage = true
        if ((sourceFailures.get(source) || 0) >= 3) { results.push({ itemno: key, file: row.file, source, status: "source_blocked", url: row.url }); continue }
        try {
          let enrichment, skipped = false
          if (store) ({ enrichment, skipped } = await storeMerchantEnrichment(row, "owner-authorized-local-cli"))
          else if (cache[key]) { enrichment = cache[key]; skipped = true }
          else enrichment = await extractMerchantEnrichment(row)
          fetchedPage = !skipped
          cache[key] = enrichment
          let localCacheSaved = true
          try { await saveCache(cache) } catch { localCacheSaved = false; console.warn("Local cache export failed; source extraction and completed database save are preserved.") }
          const result = { itemno: key, file: row.file, source, status: skipped ? "cached" : "fetched", enrichment, localCacheSaved }
          results.push(result)
          console.log(JSON.stringify({ itemno: key, source, status: result.status, gtin: !!enrichment.gtin, mpn: !!enrichment.mpn, images: enrichment.images.length }))
          sourceFailures.set(source, 0)
        } catch (error) {
          const blocked = error?.status === 429 || error?.status === 403
          if (blocked) sourceFailures.set(source, (sourceFailures.get(source) || 0) + 1)
          const message = error?.name === "ScraperError" ? error.message : /maxContentLength/i.test(String(error?.message)) ? "Source page exceeds the bounded HTML size limit" : "Source network/extraction failed"
          const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : undefined
          results.push({ itemno: key, file: row.file, source, status: blocked ? "blocked" : "failed", url: row.url, error: message, code })
          console.log(JSON.stringify({ itemno: key, source, status: blocked ? "blocked" : "failed", error: message, code }))
        }
        if (fetchedPage) await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  await Promise.all([worker(), worker()])
  const summary = { completedAt: new Date().toISOString(), inputRows: all.length, reviewedRows: results.length, mode: store ? "database-enrichment-cache" : "local-enrichment-cache", probe,
    outcomes: Object.fromEntries([...new Set(results.map(result => result.status))].map(status => [status, results.filter(result => result.status === status).length])),
    withGtin: results.filter(result => result.enrichment?.gtin).length, withMpn: results.filter(result => result.enrichment?.mpn).length,
    limitation: "Source evidence needs exact-variant and image-rights review; no live catalogue, stock, prices or Google products changed." }
  await fs.writeFile(path.join(directory, probe ? "probe-results.json" : selected.size ? "selected-results.json" : "results.json"), JSON.stringify({ summary, results }, null, 2))
  console.log(JSON.stringify(summary, null, 2))
} finally { await client?.close() }
