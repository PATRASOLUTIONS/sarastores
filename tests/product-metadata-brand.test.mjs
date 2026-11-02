import test from "node:test"
import assert from "node:assert/strict"
import { sourceLoader } from "./source-loader.mjs"

const metadata = sourceLoader().load("lib/product-metadata-sheet.ts")

function fixture(extra = {}) {
  return { _id: "phone-1", id: "phone-1", sku: "PHONE-1", name: "Nokia mobile phone blue variant",
    active: true, stock: 2, price: 100, mrp: 120, image: "/phone.png",
    manufacturerName: "HMD", raw: { Brand: "Old raw brand", "Manufacturer Name": "HMD" },
    ...metadata.metadataDocumentUpdates(metadata.extractMetadataSheetRow({ itemno: "PHONE-1", Brand: "NOKIA" })),
    ...extra }
}

function projected(product, projection) {
  const result = { _id: product._id }
  for (const path of Object.keys(projection)) {
    const [key, nested] = path.split(".")
    if (nested) {
      if (product[key]?.[nested] !== undefined) (result[key] ||= {})[nested] = product[key][nested]
    } else if (product[key] !== undefined) result[key] = product[key]
  }
  return result
}

function readers(product) {
  return sourceLoader({
    react: { cache: fn => fn },
    "@/lib/reviews": { getReviewProduct: async () => product, publishedReviewFilter: () => ({}) },
    "@/lib/db-service": { getCollection: async name => name === "reviews"
      ? { aggregate: () => ({ toArray: async () => [] }) }
      : { findOne: async () => null } },
    "@/lib/public-catalogue": { publicCatalogueFilter: async () => ({ active: true }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      find: (_, options) => {
        const cursor = { sort: () => cursor, limit: () => cursor,
          toArray: async () => [projected(product, options.projection)] }
        return cursor
      },
    }) } }) },
    "@/lib/seo-metadata": { seoText: value => String(value || "") },
  })
}

test("uploaded metadata brand is used by SEO and Merchant feed even when the manufacturer differs", async () => {
  const input = fixture(), before = JSON.stringify(input), loader = readers(input)
  assert.equal(metadata.catalogueBrand(input), "NOKIA")
  assert.equal((await loader.load("lib/seo-product.ts").getSeoProduct("phone-1")).brand, "NOKIA")
  const response = await loader.load("app/feed/google-merchant.xml/route.ts").GET()
  assert.equal(response.status, 200)
  const xml = await response.text()
  assert.ok(xml.includes("<g:brand>NOKIA</g:brand>"))
  assert.ok(!xml.includes("<g:brand>HMD</g:brand>"))
  assert.equal(JSON.stringify(input), before)
})

test("a brand-only metadata upload retains its authority through card response parsing", () => {
  const input = fixture({ division: undefined })
  const parsed = sourceLoader().load("lib/product-card-response.ts").productCardResponseSchema.parse({ ...input, id: input.id })
  assert.equal(parsed.taxonomySource, "metadata-sheet")
  assert.equal(metadata.catalogueBrand(parsed), "NOKIA")
})

test("different legitimate manufacturer does not produce a brand conflict during catalogue scan", () => {
  const input = fixture(), before = JSON.stringify(input)
  const entry = sourceLoader().load("lib/catalogue-quality.ts").auditCatalogue([input]).products[0]
  assert.equal(entry.brand, "NOKIA")
  assert.ok(!entry.issues.some(issue => issue.code === "brand-reader-conflict"))
  assert.equal(JSON.stringify(input), before)
})

test("legacy warehouse brand mapping and raw-only classified brand stay consistent across readers", async () => {
  for (const [input, expected] of [
    [fixture({ taxonomySource: undefined, brand: "Mobiles" }), "HMD"],
    [fixture({ brand: undefined, raw: { Brand: "NOKIA", "Manufacturer Name": "HMD" } }), "NOKIA"],
  ]) {
    const loader = readers(input)
    assert.equal(metadata.catalogueBrand(input), expected)
    assert.equal((await loader.load("lib/seo-product.ts").getSeoProduct("phone-1")).brand, expected)
    const xml = await (await loader.load("app/feed/google-merchant.xml/route.ts").GET()).text()
    assert.ok(xml.includes("<g:brand>" + expected + "</g:brand>"))
  }
})

test("header fallback reads a brand-only metadata upload instead of the manufacturer", async () => {
  const client = sourceLoader({}, { fetch: async url => url === "/api/brands/in-stock"
    ? Response.json({ error: "Unavailable" }, { status: 503 })
    : Response.json([fixture()], { headers: { "X-Has-More": "false" } }) }).load("lib/active-brand-client.ts")
  const brands = await client.fetchActiveProductBrands()
  assert.equal(brands.length, 1)
  assert.equal(brands[0].name, "NOKIA")
})
