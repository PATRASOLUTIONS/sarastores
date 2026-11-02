import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"

const available = { id: "public-appliance", slug: "public-appliance", name: "Current fixture appliance", price: 12345, mrp: 15000,
  stock: 5, image: "/fixture.webp", brand: "Fixture brand", description: "Current public description" }
const publicCatalogue = [available, { ...available, id: "zero-price", slug: "zero-price", name: "Zero-price fixture", price: 0 },
  { ...available, id: "no-stock", slug: "no-stock", name: "Unavailable fixture", stock: 0 }]

test("public promotion pages render current catalogue money without invented gifts, loan amounts or stale urgency", async () => {
  const loader = sourceLoader({
    "@/components/Header": () => null,
    "@/components/Footer": () => null,
    "@/components/CategoryProductCard": ({ product }) => createElement("div", { "data-product-id": product.id }, product.name),
    "@/lib/seo-page": { pageMetadata: options => () => options },
    "@/lib/public-page-data": { getPublicPageProducts: async () => publicCatalogue },
    "@/lib/db-service": { COLLECTIONS: { CATEGORIES: "categories" }, findMany: async () => [] },
  })
  for (const page of ["app/ganesh/page.tsx", "app/epic-sale/page.tsx"]) {
    const html = renderToStaticMarkup(await loader.load(page).default())
    assert.match(html, /Current fixture appliance/)
    assert.doesNotMatch(html, /Zero-price fixture|Unavailable fixture|24 months|free installation|complimentary standard installation|EMI DAY|SAFARI TROLLEY|September 2026|12 MIDNIGHT/i)
    assert.ok(html.includes('href="/shipping-policy"'))
    assert.ok(html.includes('href="/emi"'))
    assert.equal(Array.from(html.matchAll(/<h1(?:\s|>)/g)).length, 1)
    if (page.includes("epic-sale")) {
      assert.match(html, /12,345/)
      assert.match(html, /15,000/)
      assert.ok(html.includes('href="/product/public-appliance"'))
      assert.doesNotMatch(html, /22,990|54,990|emiPerDay/)
    }
  }
})

test("the ended static lucky draw is an archive without an entry form or conflicting prize promises", () => {
  const loader = sourceLoader({
    "@/components/Header": () => null,
    "@/components/Footer": () => null,
    "./LuckyDrawClient": () => createElement("form", { "data-active-entry": true }),
    "@/lib/seo-page": { pageMetadata: options => () => options },
  }, { context: { Date: { parse: Date.parse, now: () => Date.parse("2026-11-02T00:00:00Z") } } })
  const html = renderToStaticMarkup(loader.load("app/lucky-draw/page.tsx").default())
  assert.match(html, /Campaign Closed|Archived campaign/)
  assert.doesNotMatch(html, /<form|data-active-entry|5,00,000|1,00,000|Participate &amp; Win/)
  assert.equal(loader.load("app/lucky-draw/layout.tsx").generateMetadata().noIndex, true)
})

test("the public brand kit keeps one semantic page heading while retaining its typography samples", () => {
  const page = sourceLoader().load("app/brand-guidelines/page.tsx").default
  const html = renderToStaticMarkup(page())
  assert.equal(Array.from(html.matchAll(/<h1(?:\s|>)/g)).length, 1)
  assert.match(html, /H1 Hero - 48px Poppins Bold/)
})
