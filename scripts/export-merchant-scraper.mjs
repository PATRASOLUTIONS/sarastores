import fs from "node:fs/promises"
import { MongoClient } from "mongodb"
import { sourceLoader } from "../tests/source-loader.mjs"
import { localCacheWriter } from "../lib/scrapers/local-cache.mjs"

const directory = ".seo-local/merchant-scraper"
const run = JSON.parse(await fs.readFile(`${directory}/results.json`, "utf8"))
const client = new MongoClient(process.env.MONGODB_URI, { family: 4, maxPoolSize: 2, serverSelectionTimeoutMS: 12000, socketTimeoutMS: 45000 })
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise")
  const loader = sourceLoader({ "@/lib/db-service": { getCollection: async name => db.collection(name) } },
    { env: { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL } })
  const { curateMerchantEnrichment, merchantCatalogueFacts } = loader.load("lib/scrapers/merchant-enrichment.ts")
  const { merchantSheetRow, merchantSheetCsv } = loader.load("lib/scrapers/merchant-sheet.ts")
  const { scraperItemNumberQuery } = loader.load("lib/scrapers/item-numbers.ts")
  const { catalogueItemNumber } = loader.load("lib/catalogue-quality-data.ts")
  const records = await db.collection("merchant_product_enrichments").find({ status: "complete" }, { projection: { enrichment: 1 }, maxTimeMS: 15000 }).limit(20001).toArray()
  if (records.length > 20000) throw new Error("Enrichment export limit exceeded")
  const saved = new Map(records.map(record => [String(record._id), curateMerchantEnrichment(record.enrichment)]))
  const keys = [...new Set(run.results.map(result => result.itemno))]
  const products = await db.collection("products").find(scraperItemNumberQuery(keys), { projection: {
    sku: 1, itemno: 1, "raw.itemno": 1, slug: 1, price: 1, stock: 1, quantity: 1, active: 1, inStock: 1, status: 1,
    disabled: 1, enabled: 1, isActive: 1, deleted: 1, isDeleted: 1, deletedAt: 1, discontinued: 1, condition: 1 }, maxTimeMS: 15000 }).limit(20001).toArray()
  if (products.length > 20000) throw new Error("Catalogue export limit exceeded")
  let recovered = 0
  const results = run.results.map(result => {
    if (result.status === "duplicate" || !saved.has(result.itemno)) return result
    if (result.status === "failed") recovered++
    const matches = products.filter(product => catalogueItemNumber(product).trim().toUpperCase() === result.itemno)
    return { itemno: result.itemno, file: result.file, source: result.source, status: "saved", enrichment: saved.get(result.itemno),
      catalogueMatches: matches.length, sara: matches.length === 1 ? merchantCatalogueFacts(matches[0]) : null }
  })
  const complete = results.filter(result => result.enrichment)
  const summary = { ...run.summary, reconciledAt: new Date().toISOString(), reviewedRows: results.length,
    outcomes: Object.fromEntries([...new Set(results.map(result => result.status))].map(status => [status, results.filter(result => result.status === status).length])),
    recoveredFromLocalExportError: recovered, withGtin: complete.filter(result => result.enrichment.gtin).length,
    withMpn: complete.filter(result => result.enrichment.mpn).length,
    missingManufacturerIdentifiers: complete.filter(result => !result.enrichment.gtin && !result.enrichment.mpn).length,
    missingBrand: complete.filter(result => !result.enrichment.brand).length,
    missingDescription: complete.filter(result => !result.enrichment.description).length,
    missingImage: complete.filter(result => !result.enrichment.imageUrl).length,
    uniqueSaraMatches: complete.filter(result => result.catalogueMatches === 1).length }
  await fs.writeFile(`${directory}/raw-first-run-results.json`, JSON.stringify(run, null, 2))
  await fs.writeFile(`${directory}/results.json`, JSON.stringify({ summary, results }, null, 2))
  const rows = results.map(result => result.enrichment ? merchantSheetRow(result.enrichment, result.sara || undefined)
    : [result.itemno, result.url || "", "", "", "", "", "", "", result.itemno, "", "", "", "", "INR", "", "", "", "", "", "", "", "", result.status, result.error || (result.status === "duplicate" ? "Duplicate item number; skipped" : "Not fetched")])
  await fs.writeFile(`${directory}/merchant-review.csv`, merchantSheetCsv(rows))
  await localCacheWriter(`${directory}/cache.json`)(Object.fromEntries(complete.map(result => [result.itemno, result.enrichment])))
  console.log(JSON.stringify(summary, null, 2))
} finally { await client.close() }
