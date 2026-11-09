import test from "node:test"
import assert from "node:assert/strict"
import { sourceLoader } from "./source-loader.mjs"
import { localCacheWriter } from "../lib/scrapers/local-cache.mjs"

const sample = () => sourceLoader().load("lib/scrapers/types.ts").emptyProduct("bosch", "https://www.bosch-home.in/en/product/FIXTURE")
const page = extra => `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "BOSCH WASHER", brand: "Bosch", ...extra })}</script>`

test("a local export failure does not poison subsequent cache saves", async () => {
  let writes = 0, renames = 0
  const writer = localCacheWriter("fixture-cache.json", { readFile: async () => "{}", writeFile: async () => { writes++ },
    rename: async () => { if (++renames === 1) throw new Error("transient export failure") }, rm: async () => {} })
  await assert.rejects(writer({ first: {} }))
  await writer({ second: {} })
  assert.equal(writes, 2); assert.equal(renames, 2)
})

test("scraper extracts labelled GTIN/MPN, preserves zeros and ignores platform IDs and model-only codes", () => {
  const loader = sourceLoader(), enrich = loader.load("lib/scrapers/merchant-facts.ts").enrichMerchantFacts
  const product = sample(); product.sap.name = "BOSCH WASHER"
  product.technicalDetails = { "Model Number": "MODEL-ONLY", ASIN: "B012345678", FSN: "FSN-123" }
  const result = enrich(product, page({ gtin14: "04006381333931", mpn: "MANUFACTURER-PART", offers: { availability: "https://schema.org/InStock", priceCurrency: "INR" } }))
  assert.equal(result.merchantFacts.gtin, "04006381333931")
  assert.equal(result.merchantFacts.mpn, "MANUFACTURER-PART")
  assert.equal(result.merchantFacts.availability, "in_stock")
  assert.equal(result.merchantFacts.currency, "INR")
  const absent = sample(); absent.sap.name = "BOSCH WASHER"; absent.technicalDetails = product.technicalDetails
  const facts = enrich(absent, page({ sku: "PLATFORM-SKU" })).merchantFacts
  assert.equal(facts.gtin, null); assert.equal(facts.mpn, null); assert.equal(facts.availability, null)
})

test("invalid/conflicting barcodes retain evidence without becoming accepted identifiers", () => {
  const enrich = sourceLoader().load("lib/scrapers/merchant-facts.ts").enrichMerchantFacts
  const product = sample(); product.sap.name = "BOSCH WASHER"; product.technicalDetails.EAN = "4006381333932"
  const facts = enrich(product, page({ gtin13: "4006381333931" })).merchantFacts
  assert.equal(facts.gtin, null)
  assert.ok(facts.issues.some(issue => /Conflicting/.test(issue)))
  assert.equal(facts.evidence.filter(item => item.field === "gtin").length, 2)
})

test("all six retailer/manufacturer adapters preserve primary Product identifiers and ignore suggested-product images", async () => {
  const http = sourceLoader().load("lib/scrapers/http.ts")
  const primary = { "@type": "Product", name: "Fixture washer", brand: "Bosch", gtin13: "4006381333931", mpn: "MANUFACTURER-PART", sku: "RETAIL-SKU",
    description: "A synthetic fixture washer.", image: "https://fixture.invalid/primary.jpg", offers: { price: "100", priceCurrency: "INR", availability: "https://schema.org/InStock" } }
  const html = `<h1>Fixture washer</h1><meta property="og:image" content="https://fixture.invalid/primary.jpg"><script type="application/ld+json">${JSON.stringify(primary)}</script><img src="https://rukmini1.flixcart.com/image/300/300/recommended.jpg">`
  const loader = sourceLoader({ "@/lib/scrapers/http": { ...http, fetchHtml: async url => ({ html, finalUrl: url }), fetchJson: async () => null } })
  const { ADAPTERS } = loader.load("lib/scrapers/adapters.ts")
  for (const [source, adapter] of Object.entries(ADAPTERS)) {
    const result = await adapter(`https://fixture.invalid/product/${source}`)
    assert.equal(result.merchantFacts.gtin, "4006381333931", source)
    assert.equal(result.merchantFacts.mpn, "MANUFACTURER-PART", source)
    assert.deepEqual(Array.from(result.merchantFacts.primaryImages), ["https://fixture.invalid/primary.jpg"], source)
    assert.ok(result.description, source)
  }
})

function cacheFixture(failing = false) {
  const records = new Map(); let fetches = 0, writes = 0
  const collection = {
    findOne: async query => records.get(query._id) || null,
    insertOne: async record => { if (records.has(record._id)) throw Object.assign(new Error("duplicate"), { code: 11000 }); records.set(record._id, { ...record }); writes++ },
    updateOne: async (query, update) => { const record = records.get(query._id); if (record?.leaseToken !== query.leaseToken) return { matchedCount: 0 }; Object.assign(record, update.$set); delete record.leaseToken; return { matchedCount: 1 } },
    deleteOne: async query => { if (records.get(query._id)?.leaseToken === query.leaseToken) records.delete(query._id) },
    findOneAndUpdate: async () => null,
  }
  const product = sample(); product.sap.name = "Bosch Washer"; product.sap.price = 99999
  product.merchantFacts = { gtin: null, mpn: "PART-1", model: null, currency: "INR", availability: "in_stock", condition: "new", evidence: [], issues: [] }
  const loader = sourceLoader({ "@/lib/db-service": { getCollection: async name => { assert.equal(name, "merchant_product_enrichments"); return collection } },
    "@/lib/scrapers/http": { detectSource: () => "bosch", isShortLink: () => false },
    "@/lib/scrapers/adapters": { ADAPTERS: { bosch: async () => { fetches++; if (failing) throw new Error("failed page"); return product } } },
  })
  return { module: loader.load("lib/scrapers/merchant-enrichment.ts"), records, counts: () => ({ fetches, writes }) }
}

test("one-time cache skips stored item numbers across repeated/case-varied imports without refetching", async () => {
  const fixture = cacheFixture(), row = { itemno: " t001 ", url: "https://www.bosch-home.in/en/product/FIXTURE" }
  const first = await fixture.module.storeMerchantEnrichment(row, "admin-1")
  const second = await fixture.module.storeMerchantEnrichment({ ...row, itemno: "T001" }, "admin-1")
  assert.equal(first.skipped, false); assert.equal(second.skipped, true)
  assert.deepEqual(fixture.counts(), { fetches: 1, writes: 1 })
  assert.equal(second.enrichment.verificationStatus, "needs_review")
})

test("failed fetch releases its cache claim for the next upload", async () => {
  const fixture = cacheFixture(true)
  await assert.rejects(fixture.module.storeMerchantEnrichment({ itemno: "T001", url: "https://www.bosch-home.in/en/product/FIXTURE" }, "admin-1"))
  assert.equal(fixture.records.size, 0)
})

test("concurrent imports of the same item obtain only one fetch lease", async () => {
  const fixture = cacheFixture(), row = { itemno: "T001", url: "https://www.bosch-home.in/en/product/FIXTURE" }
  const outcomes = await Promise.allSettled([fixture.module.storeMerchantEnrichment(row, "admin-1"), fixture.module.storeMerchantEnrichment(row, "admin-2")])
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(fixture.counts().fetches, 1)
})

test("review CSV keeps Sara prices/stock separate from competitor suggestions and escapes formulas", () => {
  const sheet = sourceLoader().load("lib/scrapers/merchant-sheet.ts")
  const enrichment = { itemno: "=BAD", sourceUrl: "https://www.bosch-home.in/en/product/FIXTURE", title: "Bosch", brand: "Bosch", description: "Facts", imageUrl: "https://fixture.invalid/image.jpg", images: [], sourcePrice: 99999, issues: [] }
  const row = sheet.merchantSheetRow(enrichment, { price: 10000, stock: 4 })
  assert.equal(row[6], 10000); assert.equal(row[7], 4); assert.equal(row[17], 99999)
  assert.ok(sheet.merchantSheetCsv([row]).includes("\"'=BAD\""))
})

test("new enrichment API requires full admin for both reading and storing", async () => {
  const route = sourceLoader({ "@/lib/auth": { requireFullAdmin: async () => ({ ok: false, response: new Response(null, { status: 403 }) }) } }).load("app/api/scrape/merchant/route.ts")
  assert.equal((await route.GET(new Request("https://fixture.invalid/api/scrape/merchant?itemno=T001"))).status, 403)
  assert.equal((await route.POST(new Request("https://fixture.invalid/api/scrape/merchant", { method: "POST" }))).status, 403)
})
