import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

const product = { _id: "fixture-product", id: "fixture-product", slug: "fixture-phone", name: "Fixture Phone", description: "Public description",
  active: true, price: 12000, stock: 5, image: "/phone.webp", brand: "Catalogue Brand", taxonomySource: "metadata-sheet", vendorSecret: "must-not-leave-server",
  raw: { Brand: "Catalogue Brand", "Manufacturer Name": "Other manufacturer", privateNote: "must-not-leave-server" } }
const normalizeId = value => Array.isArray(value) ? value.map(normalizeId) : Object.fromEntries(Object.entries({ ...value, id: String(value._id) }).filter(([key]) => key !== "_id"))

test("server public loaders preserve authoritative identity and omit private operational fields", async () => {
  const before = JSON.stringify(product)
  const loader = sourceLoader({
    react: { cache: fn => fn },
    "@/lib/db-service": { normalizeId, getCollection: async name => ({
      find: () => ({ sort() { return this }, toArray: async () => name === "products" ? [product] : [] }),
      findOne: async () => null,
    }) },
    "@/lib/public-catalogue": { publicCatalogueFilter: async () => ({ active: true }) },
    "@/lib/reviews": { getReviewProduct: async () => product },
  }).load("lib/public-page-data.ts")
  for (const result of [(await loader.getPublicPageProducts())[0], await loader.getPublicPageProduct(product.slug)]) {
    assert.equal(result.id, product.id)
    assert.equal(result.price, product.price)
    assert.equal(result.brand, "Catalogue Brand")
    assert.equal(result.vendorSecret, undefined)
    assert.equal(result._id, undefined)
    assert.equal(result.raw.privateNote, undefined)
  }
  assert.equal(JSON.stringify(product), before)
})

test("server page provides its public product before hydration and rejects a missing product", async () => {
  let available = true
  const loader = sourceLoader({
    "@/lib/public-page-data": { getPublicPageProduct: async () => available ? product : null },
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND") } },
    "./ProductDetailClient": () => null,
  })
  const page = loader.load("app/product/[slug]/page.tsx").default
  const element = await page({ params: Promise.resolve({ slug: product.slug }) })
  assert.equal(element.props.initialProduct.name, product.name)
  available = false
  await assert.rejects(page({ params: Promise.resolve({ slug: "missing" }) }), /NOT_FOUND/)
})

test("sitemap refuses to publish a partial catalogue after a source failure", async () => {
  const loader = sourceLoader({
    "@/lib/seo-metadata": { getOriginFromHeaders: async () => "https://www.sarastores.com", absoluteSeoImage: () => undefined },
    "@/lib/public-catalogue": { publicCatalogueFilter: async () => ({}) },
    "@/lib/db-service": { getCollection: async () => { throw new Error("fixture source down") } },
  })
  await assert.rejects(loader.load("app/sitemap.ts").default(), /Sitemap products source unavailable/)
})

test("strict sitemap loaders propagate source failures while storefront fallbacks remain available", async () => {
  const loader = sourceLoader({ "@/lib/db-service": { getCollection: async () => { throw new Error("fixture down") } } })
  const articles = loader.load("lib/articles.ts")
  const stores = loader.load("lib/store-locations.ts")
  assert.equal((await articles.listArticles()).length, 0)
  assert.equal((await stores.getAllStoreLocations()).length, 0)
  await assert.rejects(articles.listArticles({ strict: true }), /fixture down/)
  await assert.rejects(stores.getAllStoreLocations({ strict: true }), /fixture down/)
})


test("listing reads project detail blobs without limiting catalogue completeness", async () => {
  let requestedProjection
  const records = Array.from({ length: 150 }, (_, i) => ({ ...product, _id: `fixture-${i}`, name: `Fixture Phone ${i}` }))
  const loader = sourceLoader({
    react: { cache: fn => fn },
    "@/lib/db-service": { normalizeId, getCollection: async () => ({
      find: (filter, options) => {
        assert.deepEqual(filter, { active: true })
        assert.equal(options.batchSize, 100)
        requestedProjection = options.projection
        // A limit() call is deliberately unsupported: eligible items beyond the
        // API's first page must remain available to server-rendered filters.
        return { sort() { return this }, toArray: async () => records }
      },
    }) },
    "@/lib/public-catalogue": { publicCatalogueFilter: async () => ({ active: true }) },
  }).load("lib/public-page-data.ts")
  assert.equal((await loader.getPublicPageProducts()).length, 150)
  assert.equal(requestedProjection.description, 1)
  assert.equal(requestedProjection["raw.Brand"], 1)
  assert.equal(requestedProjection["raw.Manufacturer Name"], 1)
  assert.equal(requestedProjection["raw.MRP"], 1)
  assert.equal(requestedProjection.raw, undefined)
  assert.equal(requestedProjection.technical_details, undefined)
  assert.equal(requestedProjection.vendorSecret, undefined)
  assert.equal(requestedProjection.specification_images.$slice, 2)
  assert(Object.keys(requestedProjection).every(key => !key.endsWith(".")))
})


test("product pages normalize BSON specification dates and retain full detail content", async () => {
  const detailProduct = { ...product, sku: "FIXTURE-SKU" }
  const specs = { updatedAt: new Date("2026-01-02T03:04:05Z"), technical_details: { Details: "Full product specification" },
    reviews: [{ rating: 5, createdAt: new Date("2026-01-01T00:00:00Z") }] }
  const loader = sourceLoader({
    react: { cache: fn => fn },
    "@/lib/db-service": { normalizeId, getCollection: async name => {
      assert.equal(name, "product_specifications")
      return { findOne: async () => specs }
    } },
    "@/lib/reviews": { getReviewProduct: async () => detailProduct },
  }).load("lib/public-page-data.ts")
  const result = await loader.getPublicPageProduct(detailProduct.slug)
  assert.equal(result.technical_details.Details, "Full product specification")
  assert.equal(result.reviews[0].createdAt, "2026-01-01T00:00:00.000Z")
  assert.equal(result.id, detailProduct.id)
  assert(specs.updatedAt instanceof Date)
})
