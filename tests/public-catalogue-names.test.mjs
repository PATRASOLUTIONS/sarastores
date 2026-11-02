import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"

const product = (_id, stock = 0, extra = {}) => ({ _id, name: "Phone 8GB Blue", sku: `SKU-${_id}`, stock, price: 100, image: "/fixture.png", active: true, ...extra })
const equal = (a, b) => a == null && b == null || String(a) === String(b)
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$and") return value.every(part => matches(row, part))
    if (key === "$or") return value.some(part => matches(row, part))
    if (key === "$expr") return Number(row.stock) > 0
    const actual = row[key]
    if (Object.prototype.toString.call(value) === "[object RegExp]") return value.test(String(actual ?? ""))
    if (value && typeof value === "object") {
      if ("$in" in value) return value.$in.some(candidate => equal(actual, candidate))
      if ("$nin" in value) return !value.$nin.some(candidate => equal(actual, candidate))
      if ("$ne" in value) return !equal(actual, value.$ne)
      if ("$regex" in value) return new RegExp(value.$regex, value.$options).test(String(actual ?? ""))
    }
    return equal(actual, value)
  })
}

function fixture(records, extra = {}) {
  const reads = []
  const normalizeId = docs => Array.isArray(docs) ? docs.map(normalizeId) : docs ? Object.fromEntries([
    ...Object.entries(docs).filter(([key]) => key !== "_id" && key !== "id"), ["id", String(docs._id)],
  ]) : null
  const collection = {
    find(filter, options = {}) {
      reads.push({ filter, options })
      let rows = records.filter(row => matches(row, filter)), skip = 0, limit = Infinity
      let projection = options.projection
      const cursor = {
        sort() { rows = [...rows].sort((a, b) => String(a._id).localeCompare(String(b._id))); return cursor },
        skip(value) { skip = value; return cursor },
        limit(value) { limit = value || Infinity; return cursor },
        project(value) { projection = value; return cursor },
        async toArray() {
          return rows.slice(skip, skip + limit).map(row => {
            if (!projection) return row
            const result = { _id: row._id }
            for (const [key, expression] of Object.entries(projection)) {
              if (key.startsWith("raw.")) {
                const field = key.slice(4)
                if (row.raw?.[field] !== undefined) result.raw = { ...result.raw, [field]: row.raw[field] }
              } else if (row[key] !== undefined) result[key] = expression?.$slice ? row[key].slice(0, expression.$slice) : row[key]
            }
            return result
          })
        },
      }
      return cursor
    },
    async findOne(filter) { return records.find(row => matches(row, filter)) ?? null },
    async countDocuments(filter) { return records.filter(row => matches(row, filter)).length },
  }
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: name => name === "products" ? collection : { find: () => ({ limit() { return this }, toArray: async () => [] }) } } }) },
    "@/lib/db-service": {
      getCollection: async name => {
        if (name === "campaign_pages") return { findOne: async () => extra.campaign }
        if (name === "users") return { findOne: async () => ({ recentlyViewed: extra.recentlyViewed }) }
        assert.equal(name, "products"); return collection
      },
      COLLECTIONS: { PRODUCTS: "products" }, normalizeId,
      count: async (_name, filter) => collection.countDocuments(filter),
      createObjectId: id => { throw new Error(`Synthetic ID: ${id}`) },
    },
    "@/lib/auth": { isAdmin: async () => false, requireAdmin: async () => ({ ok: true }), getCurrentUserId: async () => "123456789012345678901234" },
    "@/lib/seo-metadata": { getOriginFromHeaders: async () => "https://fixture.invalid", getSiteSettings: async () => null, getCompanyName: () => "Fixture", seoText: value => String(value) },
    "@/lib/cache": { withCache: async (_key, callback) => callback(), cacheKeys: { searchResults: value => value }, CACHE_TTL: { SHORT: 1 } },
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { SEARCH: {} } },
  })
  return { loader, reads, records, normalizeId }
}
const get = (fixture, query = "") => fixture.loader.load("app/api/products/route.ts").GET(new NextRequest(`https://fixture.invalid/api/products?${query}`))
const ids = rows => Array.from(rows, row => row.id)

test("public pages choose stock across the full catalogue before pagination and count unique names", async () => {
  const records = [product("a", 0), ...Array.from({ length: 510 }, (_, n) => product(`b-${String(n).padStart(3, "0")}`, 1, { name: `Other ${n}` })), product("z", "55")]
  const before = JSON.stringify(records), f = fixture(records)
  const first = await get(f, "limit=500"), last = await get(f, "limit=500&skip=500")
  assert.equal(first.status, 200)
  assert.equal(first.headers.get("X-Total-Count"), "511")
  assert.equal(first.headers.get("X-Has-More"), "true")
  const rows = [...await first.json(), ...await last.json()]
  assert.equal(rows.length, 511)
  assert.equal(new Set(rows.map(row => row.name)).size, 511)
  assert.equal(rows.some(row => row.id === "a"), false)
  assert.equal(rows.find(row => row.id === "z").stock, "55")
  assert.equal(last.headers.get("X-Has-More"), "false")
  assert.equal(JSON.stringify(records), before)
  const scan = f.reads.find(read => read.options.maxTimeMS === 8000)
  assert.ok(scan)
  assert.equal(scan.options.projection.raw, undefined, "large raw payloads are excluded from name selection")
})

test("stock, search and category filters cannot bring back a non-selected same-name copy", async () => {
  const f = fixture([product("a", 0, { category: "Legacy" }), product("z", 3, { category: "Current" })])
  assert.deepEqual(ids(await (await get(f, "search=phone&inStock=true")).json()), ["z"])
  assert.deepEqual(ids(await (await get(f, "category=Legacy")).json()), [])
  assert.deepEqual(ids(await (await get(f, "category=Current")).json()), ["z"])
})

test("inactive and disabled higher-stock records never suppress the eligible representative", async () => {
  const f = fixture([product("a", 2), product("b", 100, { active: false }), product("c", 200, { disabled: true })])
  assert.deepEqual(ids(await (await get(f)).json()), ["a"])
})

test("zero-stock groups use latest update and stable IDs, with legacy names and variants preserved", async () => {
  const f = fixture([product("a", 0, { updatedAt: new Date("2026-10-01") }), product("b", 0, { name: " PHONE   8GB blue ", updatedAt: new Date("2026-10-02") }), product("c", 0, { name: "Phone 16GB Blue" }), product("d", 0, { name: "", raw: { Name: "Legacy phone" } }), product("e", 0, { name: "", raw: { Name: "Legacy phone" } })])
  assert.deepEqual(ids(await (await get(f)).json()), ["b", "c", "d"])
})

test("fresh reads change the representative when stock changes without persisting any selection", async () => {
  const records = [product("a", 0), product("z", 3)], f = fixture(records)
  assert.deepEqual(ids(await (await get(f)).json()), ["z"])
  records[0].stock = 10
  assert.deepEqual(ids(await (await get(f)).json()), ["a"])
})

test("admin listing still returns every record and bypasses public name selection", async () => {
  const f = fixture([product("a", 0), product("z", 3), product("inactive", 5, { active: false })])
  const response = await get(f, "fields=admin")
  assert.deepEqual(ids(await response.json()), ["a", "inactive", "z"])
  assert.equal(f.reads.length, 1)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
})

test("curated bulk resolves both copies to one stocked record; cart and compare lookups keep exact IDs", async () => {
  const f = fixture([product("a", 0), product("z", 3)])
  const route = f.loader.load("app/api/products/bulk/route.ts")
  const request = body => new NextRequest("https://fixture.invalid/api/products/bulk", { method: "POST", body: JSON.stringify(body) })
  assert.deepEqual(ids(await (await route.POST(request({ ids: ["a", "z"], catalogue: true }))).json()), ["z"])
  assert.deepEqual(ids(await (await route.POST(request({ ids: ["a", "z"] }))).json()), ["a", "z"])
  assert.deepEqual(ids(await (await route.POST(request({ ids: ["a", "z"], compare: true }))).json()), ["a", "z"])
})

test("curated single lookup resolves the representative while ordinary detail lookup retains its ID", async () => {
  const f = fixture([product("a", 0), product("z", 3)])
  const route = f.loader.load("app/api/products/[id]/route.ts")
  const request = query => route.GET(new NextRequest(`https://fixture.invalid/api/products/a${query}`), { params: Promise.resolve({ id: "a" }) })
  assert.equal((await (await request("?catalogue=true")).json()).id, "z")
  assert.equal((await (await request("")).json()).id, "a")
})

test("search suggestions use the selected stocked product before limiting results", async () => {
  const f = fixture([product("a", 0), product("z", 3)])
  const response = await f.loader.load("app/api/search/suggestions/route.ts").GET(new NextRequest("https://fixture.invalid/api/search/suggestions?q=phone&limit=4"))
  assert.equal(response.status, 200)
  const rows = (await response.json()).suggestions.filter(row => row.type === "product")
  assert.deepEqual(ids(rows), ["product-z"])
})

test("browser-cached public lists also select maximum stock without changing stored product objects", () => {
  const f = fixture([])
  const schemas = f.loader.load("lib/product-card-response.ts")
  const rows = [product("a", 0), product("z", 3)].map(f.normalizeId)
  const before = JSON.stringify(rows)
  assert.deepEqual(ids(schemas.productListingListResponseSchema.parse(rows)), ["z"])
  assert.deepEqual(ids(f.loader.load("utils/catalog.ts").catalogProductListResponseSchema.parse(rows)), ["z"])
  assert.deepEqual(ids(f.loader.load("lib/home-components-client.ts").homeProductListResponseSchema.parse(rows)), ["z"])
  assert.equal(JSON.stringify(rows), before)
})

test("oversize selection fails explicitly instead of exposing duplicate or incomplete results", async () => {
  const f = fixture(Array.from({ length: 20001 }, (_, n) => product(String(n), 0, { name: `Other ${n}` })))
  await assert.rejects(f.loader.load("lib/public-catalogue.ts").getPublicCatalogueSelection(), /selection limit/)
})

test("campaign merchandising resolves different selected IDs to a single stocked representative", async () => {
  const campaign = { _id: "campaign", name: "Fixture campaign", slug: "fixture", isActive: true, productIds: ["a", "z"] }
  const f = fixture([product("a", 0), product("z", 3)], { campaign })
  const response = await f.loader.load("app/api/campaign-pages/[slug]/route.ts").GET(new Request("https://fixture.invalid/api/campaign-pages/fixture"), { params: Promise.resolve({ slug: "fixture" }) })
  assert.equal(response.status, 200)
  assert.deepEqual(ids((await response.json()).campaign.products), ["z"])
  assert.deepEqual(campaign.productIds, ["a", "z"])
})

test("account recently-viewed display resolves representatives without rewriting stored history", async () => {
  const recentlyViewed = ["a", "z"], f = fixture([product("a", 0), product("z", 3)], { recentlyViewed })
  const response = await f.loader.load("app/api/user/recently-viewed/route.ts").GET()
  assert.equal(response.status, 200)
  assert.deepEqual(ids((await response.json()).products), ["z"])
  assert.deepEqual(recentlyViewed, ["a", "z"])
})

test("public RSS and Merchant feeds expose one selected product for a repeated name", async () => {
  for (const path of ["app/feed.xml/route.ts", "app/feed/google-merchant.xml/route.ts"]) {
    const f = fixture([product("a", 0), product("z", 3)])
    const response = await f.loader.load(path).GET()
    assert.equal(response.status, 200)
    const xml = await response.text()
    assert.equal(xml.match(/<item>/g)?.length, 1)
    assert.match(xml, /\/product\/z/)
    assert.doesNotMatch(xml, /\/product\/a/)
  }
})

test("recommendations do not repeat the viewed product under another item number", () => {
  const f = fixture([]), catalog = f.loader.load("utils/catalog.ts")
  const seed = { id: "a", name: "Phone 8GB Blue", category: "Phones", subCategory: "Mobiles", price: 100 }
  const products = [product("z", 3), product("other", 2, { name: "Other phone" })].map(row => ({ ...f.normalizeId(row), image: "/fixture.png", subCategory: "Mobiles", category: "Phones" }))
  assert.deepEqual(ids(catalog.similarProducts(seed, products)), ["other"])
  assert.deepEqual(ids(catalog.productSuggestions(seed, products)), ["other"])
})
