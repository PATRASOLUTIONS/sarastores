import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

const normalizeId = record => ({ ...record, id: String(record._id) })
test("public campaign seed resolves representative products and strips internal campaign/software fields", async () => {
  const docs = {
    campaign_pages: [{ _id: "campaign", name: "Fixture Campaign", slug: "fixture-campaign", isActive: true, productIds: ["legacy-product"], internalNote: "private" }],
    products: [{ _id: "winner", name: "Fixture Product", price: 100, stock: 2, active: true, brand: "Fixture", image: "/image.webp" }],
    software_products: [{ _id: "software", name: "Fixture Software", status: "active", pricing: { pack1: 100 }, licenseKeys: ["private"], providerSecret: "private" }],
  }
  const loader = sourceLoader({ react: { cache: fn => fn },
    "@/lib/reviews": { getReviewProduct: async () => null },
    "@/lib/db-service": { normalizeId, getCollection: async name => ({
      find: () => ({ sort() { return this }, toArray: async () => docs[name] || [] }),
      findOne: async () => docs[name]?.[0] || null,
    }) },
    "@/lib/public-catalogue": { publicCatalogueFilter: async () => ({}), getPublicCatalogueSelection: async () => ({ representativeIds: new Map([["legacy-product", "winner"]]) }) },
  }).load("lib/public-page-data.ts")
  const campaign = await loader.getPublicPageCampaign("fixture-campaign")
  assert.equal(campaign.products[0].id, "winner")
  assert.equal(campaign.internalNote, undefined)
  const software = (await loader.getPublicPageSoftware())[0]
  assert.equal(software.id, "software")
  assert.equal(software.pricing.pack1, 100)
  assert.equal(software.licenseKeys, undefined)
  assert.equal(software.providerSecret, undefined)
  assert.equal(software._id, undefined)
})

test("subcategory server seed includes canonical matches beyond a bounded API page and rejects missing taxonomy", async () => {
  let taxonomy = [{ name: "Smart Phones", slug: "phones" }]
  const products = Array.from({ length: 700 }, (_, index) => ({ id: String(index), name: `Fixture ${index}`, price: 100, stock: 2, subCategory: index === 699 ? "Smart Phones" : "Other", brand: "Fixture" }))
  const loader = sourceLoader({
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND") } }, "./SubCategoryClient": () => null,
    "@/lib/public-page-data": { getPublicPageSubCategories: async () => taxonomy, getPublicPageProducts: async () => products, getPublicPageCategories: async () => [] },
  })
  const page = loader.load("app/sub-category/[name]/page.tsx").default
  const result = await page({ params: Promise.resolve({ name: "phones" }) })
  assert.equal(result.props.initialName, "Smart Phones")
  assert.equal(result.props.initialProducts.length, 1)
  assert.equal(result.props.initialProducts[0].id, "699")
  taxonomy = []
  await assert.rejects(page({ params: Promise.resolve({ name: "missing" }) }), /NOT_FOUND/)
})
