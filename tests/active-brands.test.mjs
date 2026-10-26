import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

test("header brand requests share one load, and Retry bypasses the cached result", async () => {
  let calls = 0
  const client = sourceLoader({}, { fetch: async url => {
    assert.equal(url, "/api/brands/in-stock")
    calls++
    return Response.json({ brands: [{ name: calls === 1 ? "LG" : "SAMSUNG", count: 1 }] })
  } }).load("lib/active-brand-client.ts")
  const [first, second] = await Promise.all([client.fetchActiveProductBrands(), client.fetchActiveProductBrands()])
  assert.equal(calls, 1)
  assert.equal(first[0].name, "LG")
  assert.equal(second[0].name, "LG")
  assert.equal((await client.fetchActiveProductBrands())[0].name, "LG")
  assert.equal(calls, 1)
  assert.equal((await client.fetchActiveProductBrands(true))[0].name, "SAMSUNG")
  assert.equal(calls, 2)
})

test("a failed brand endpoint falls back to all pages and excludes inactive and zero-stock products", async () => {
  const urls = []
  const client = sourceLoader({}, { fetch: async url => {
    urls.push(url)
    if (url === "/api/brands/in-stock") return Response.json({ error: "Unavailable" }, { status: 503 })
    assert.ok(url.includes("inStock=true"))
    if (url.endsWith("skip=0")) return Response.json(Array.from({ length: 1000 }, () => ({ active: true, manufacturerName: " LG ", stock: 5 })),
      { headers: { "X-Has-More": "true" } })
    assert.ok(url.endsWith("skip=1000"))
    return Response.json([
      { active: true, manufacturerName: "lg", stock: "2" },
      { active: true, manufacturerName: "", manufacturer_name: "SAMSUNG", stock: 3 },
      { active: true, brand: "APPLE", stock: 4 },
      { active: false, manufacturerName: "Inactive brand", stock: 5 },
      { manufacturerName: "Missing active flag", stock: 5 },
      { active: true, manufacturerName: "Zero stock brand", stock: 0 },
      { active: true, manufacturerName: "Invalid stock brand", stock: "invalid" },
      { active: true, manufacturerName: "No stock brand" },
      { active: true, manufacturerName: " ", stock: 5 },
    ], { headers: { "X-Has-More": "false" } })
  } }).load("lib/active-brand-client.ts")
  const brands = await client.fetchActiveProductBrands()
  assert.equal(urls.length, 3)
  assert.equal(brands.length, 3)
  assert.equal(brands.find(brand => brand.name === "LG").count, 1001)
  assert.deepEqual(Array.from(brands, brand => brand.name), ["APPLE", "LG", "SAMSUNG"])
})

test("an invalid brand response also falls back to the public catalogue", async () => {
  const client = sourceLoader({}, { fetch: async url => Response.json(url === "/api/brands/in-stock"
    ? { brands: [{ name: "LG" }] }
    : [{ active: true, manufacturerName: "LG", stock: 5 }], { headers: { "X-Has-More": "false" } }),
  }).load("lib/active-brand-client.ts")
  assert.equal((await client.fetchActiveProductBrands())[0].name, "LG")
})

test("a failed fallback remains retryable and never caches a successful empty catalogue", async () => {
  let failing = true
  const client = sourceLoader({}, { fetch: async () => failing
    ? Response.json({ error: "Unavailable" }, { status: 503 })
    : Response.json({ brands: [{ name: "LG", count: 2 }] }),
  }).load("lib/active-brand-client.ts")
  await assert.rejects(client.fetchActiveProductBrands(), /could not be loaded/)
  failing = false
  assert.equal((await client.fetchActiveProductBrands(true))[0].name, "LG")
})
