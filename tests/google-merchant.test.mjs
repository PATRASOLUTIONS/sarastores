import test from "node:test"
import assert from "node:assert/strict"
import { sourceLoader } from "./source-loader.mjs"

const env = { SESSION_SECRET: "isolated-merchant-preview-secret-32", NEXT_PUBLIC_SITE_URL: "https://www.sarastores.com",
  GOOGLE_MERCHANT_ACCOUNT_ID: "123", GOOGLE_MERCHANT_DATA_SOURCE_ID: "456", GOOGLE_MERCHANT_CLIENT_ID: "fixture-client",
  GOOGLE_MERCHANT_CLIENT_SECRET: "fixture-secret", GOOGLE_MERCHANT_REFRESH_TOKEN: "fixture-refresh" }
const product = (extra = {}) => ({ id: "phone-1", sku: "PHONE-1", slug: "apple-phone", name: "APPLE IPHONE 15 (128GB) BLACK",
  description: "Apple iPhone 15 with 128GB storage in Black.", brand: "Apple", taxonomySource: "metadata-sheet",
  price: 19499.25, stock: 2, active: true, image: "/images/phone.jpg", gtin: "4006381333931", ...extra })
const module = () => sourceLoader().load("lib/google-merchant-products.ts")

test("metadata preview and saved names retain iPhone styling, storage, units and model codes", () => {
  const loader = sourceLoader()
  const formatter = loader.load("lib/product-name-format.ts").formatProductName
  assert.equal(formatter("  APPLE IPHONE 15 (128GB) BLACK  "), "Apple iPhone 15 (128GB) Black")
  assert.equal(formatter("SAMSUNG GALAXY A15 5G (8GB+128GB) BLUE"), "Samsung Galaxy A15 5G (8GB+128GB) Blue")
  assert.equal(formatter("BOSCH 7kg WASHER 1200RPM"), "Bosch 7kg Washer 1200RPM")
  assert.equal(formatter("APPLE MACBOOK AIR M2 256gb"), "Apple MacBook Air M2 256GB")
  const metadata = loader.load("lib/product-metadata-sheet.ts")
  const row = metadata.extractMetadataSheetRow({ itemno: "T001", Name: "APPLE IPHONE 15 (128GB) BLACK", Brand: "APPLE" })
  assert.equal(row.name, "Apple iPhone 15 (128GB) Black")
  assert.equal(metadata.metadataDocumentUpdates(row).name, row.name)
  assert.equal(row.brand, "APPLE")
  assert.equal(row.itemno, "T001")
  assert.equal(metadata.metadataDocumentUpdates(metadata.extractMetadataSheetRow({ itemno: "T001", Brand: "APPLE" })).name, undefined)
})

test("Merchant v1 input uses verified identifiers, preserved offer IDs and integer INR micros", () => {
  const before = product(), original = JSON.stringify(before)
  const item = module().merchantPreviewItem(before, "https://www.sarastores.com", "IN")
  assert.equal(item.errors.length, 0)
  assert.equal(item.input.offerId, "PHONE-1")
  assert.equal(item.input.contentLanguage, "en")
  assert.equal(item.input.productAttributes.title, "Apple iPhone 15 (128GB) Black")
  assert.equal(item.input.productAttributes.price.amountMicros, "19499250000")
  assert.equal(item.input.productAttributes.price.currencyCode, "INR")
  assert.equal(item.input.productAttributes.availability, "IN_STOCK")
  assert.equal(item.input.productAttributes.mpn, undefined)
  assert.equal(item.input.productAttributes.identifierExists, true)
  assert.equal(JSON.stringify(before), original)
})

test("inactive, unknown-stock, invalid-price, retailer-copy and fabricated-identifier items are blocked", () => {
  for (const extra of [{ active: false }, { stock: 0 }, { stock: -1 }, { stock: undefined }, { stock: 1.5 },
    { inStock: false }, { disabled: true }, { price: 0 }, { gtin: "4006381333932" }, { gtin: undefined },
    { mpn: "PHONE-1" }, { description: "Shop at Flipkart" }, { image: "data:image/png;base64,ABC" },
    { condition: "used" }, { description: "x".repeat(5001) }]) {
    const item = module().merchantPreviewItem(product(extra), "https://www.sarastores.com", "IN")
    assert.equal(item.input, null, JSON.stringify(extra))
    assert.ok(item.errors.length)
  }
  const absent = module().merchantPreviewItem(product({ gtin: undefined, identifierExists: false }), "https://www.sarastores.com", "IN")
  assert.equal(absent.input.productAttributes.identifierExists, false)
})

test("signed previews are bound to owner, account, data source and exact product facts", () => {
  const loader = sourceLoader({}, { env })
  const api = loader.load("lib/google-merchant-api.ts")
  const input = module().merchantPreviewItem(product(), "https://www.sarastores.com", "IN").input
  const token = api.signMerchantPreview("admin-1", ["phone-1"], [input])
  assert.ok(token)
  assert.equal(api.verifyMerchantPreview(token, "admin-1").digest, api.merchantPayloadDigest([input]))
  assert.throws(() => api.verifyMerchantPreview(token, "admin-2"), /expired or changed/)
  assert.throws(() => api.verifyMerchantPreview(token + "x", "admin-1"), /expired or changed/)
  loader.env.GOOGLE_MERCHANT_DATA_SOURCE_ID = "789"
  assert.throws(() => api.verifyMerchantPreview(token, "admin-1"), /expired or changed/)
})

function providerFixture(existingSource = null, failure = false, inputType = "API") {
  const calls = []
  const fetch = async (url, options = {}) => {
    const value = String(url); calls.push({ url: value, options })
    if (value === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "fixture-access", scope: "https://www.googleapis.com/auth/content" })
    if (value.includes("/datasources/v1/")) return Response.json({ name: "accounts/123/dataSources/456", input: inputType,
      primaryProductDataSource: { countries: ["IN"], contentLanguage: "en", feedLabel: "IN" } })
    if (options.method === "POST") {
      if (failure) throw new Error("isolated timeout")
      return Response.json({ name: "received" })
    }
    return existingSource ? Response.json({ dataSource: existingSource }) : new Response(null, { status: 404 })
  }
  return { calls, api: sourceLoader({}, { env, fetch }).load("lib/google-merchant-api.ts") }
}

test("Merchant submissions verify API source and existing ownership before writes", async () => {
  const input = module().merchantPreviewItem(product(), "https://www.sarastores.com", "IN").input
  const fixture = providerFixture()
  const results = await fixture.api.submitMerchantInputs([input])
  assert.equal(results[0].status, "submitted")
  const sent = fixture.calls.find(call => call.url.includes("productInputs:insert"))
  assert.ok(sent.url.includes("/products/v1/"))
  assert.ok(sent.url.includes("dataSource=accounts%2F123%2FdataSources%2F456"))
  assert.equal(JSON.parse(sent.options.body).productAttributes.availability, "IN_STOCK")
  for (const blocked of [providerFixture("accounts/123/dataSources/999"), providerFixture(null, false, "FILE")]) {
    await assert.rejects(blocked.api.submitMerchantInputs([input]), /another data source|primary API/)
    assert.equal(blocked.calls.some(call => call.url.includes("productInputs:insert")), false)
  }
})

test("ambiguous provider failures stop the batch without retrying writes", async () => {
  const input = module().merchantPreviewItem(product(), "https://www.sarastores.com", "IN").input
  const fixture = providerFixture(null, true)
  const results = await fixture.api.submitMerchantInputs([input, { ...input, offerId: "PHONE-2" }])
  assert.equal(results[0].status, "unknown")
  assert.equal(results[1].status, "not-sent")
  assert.equal(fixture.calls.filter(call => call.url.includes("productInputs:insert")).length, 1)
})

test("both Merchant routes enforce full-admin authorization before reading products or contacting Google", async () => {
  const route = sourceLoader({ "@/lib/auth": { requireFullAdmin: async () => ({ ok: false, response: new Response(null, { status: 403 }) }) } }).load("app/api/admin/google-merchant/route.ts")
  assert.equal((await route.GET(new Request("https://www.sarastores.com/api/admin/google-merchant"))).status, 403)
  assert.equal((await route.POST(new Request("https://www.sarastores.com/api/admin/google-merchant", { method: "POST" }))).status, 403)
})

test("Merchant submission rechecks approved product facts and rejects cross-origin or unconfirmed requests", async () => {
  let current = product()
  let submissions = 0
  const loader = sourceLoader({
    "@/lib/auth": { requireFullAdmin: async () => ({ ok: true, user: { id: "admin-1" } }) },
    "@/lib/public-catalogue": { publicCatalogueFilter: async filter => filter },
    "@/lib/db-service": { normalizeId: values => values, getCollection: async () => ({
      countDocuments: async () => 1,
      find: () => { const cursor = { sort: () => cursor, skip: () => cursor, limit: () => cursor,
        toArray: async () => [current] }; return cursor },
    }) },
  }, { env, fetch: async () => { submissions++; throw new Error("No provider request expected") } })
  const api = loader.load("lib/google-merchant-api.ts")
  const route = loader.load("app/api/admin/google-merchant/route.ts")
  const input = module().merchantPreviewItem(current, "https://www.sarastores.com", "IN").input
  const token = api.signMerchantPreview("admin-1", ["phone-1"], [input])
  const request = (body, origin) => new Request("https://www.sarastores.com/api/admin/google-merchant", {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
  })
  assert.equal((await route.POST(request({ token, confirmed: false }))).status, 400)
  assert.equal((await route.POST(request({ token, confirmed: true }, "https://foreign.invalid"))).status, 403)
  current = product({ price: 9999 })
  assert.equal((await route.POST(request({ token, confirmed: true }))).status, 409)
  current = product({ stock: 0 })
  assert.equal((await route.POST(request({ token, confirmed: true }))).status, 409)
  assert.equal(submissions, 0)
})
