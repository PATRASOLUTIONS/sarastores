import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

test("manufacturer server pages seed only their public brand and positive prices before hydration", async () => {
  for (const brand of ["bosch", "haier", "lg", "tcl"]) {
    const matching = { id: `${brand}-fixture`, name: "Fixture appliance", price: 100, stock: 5, brand,
      taxonomySource: "metadata-sheet", raw: { Brand: brand, "Manufacturer Name": "Other manufacturer" } }
    const loader = sourceLoader({
      "@/lib/public-page-data": { getPublicPageProducts: async () => [matching, { ...matching, id: "zero", price: 0 },
        { ...matching, id: "different", brand: "Other brand", raw: { Brand: "Other brand", "Manufacturer Name": brand } }] },
      "./BrandClient": () => null,
    })
    const element = await loader.load(`app/${brand}/page.tsx`).default()
    assert.deepEqual(Array.from(element.props.initialProducts, product => product.id), [matching.id])
  }
})

test("fixed campaign server page seeds its campaign and rejects missing campaigns", async () => {
  let available = true
  const campaign = { id: "campaign", name: "Synthetic Sunday", slug: "super-sunday", banner: "", products: [], isActive: true }
  const loader = sourceLoader({
    "@/lib/public-page-data": { getPublicPageCampaign: async slug => {
      assert.equal(slug, "super-sunday")
      return available ? campaign : null
    } },
    "@/components/CampaignExperience": () => null,
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND") } },
  })
  const page = loader.load("app/super-sunday/page.tsx").default
  const result = await page()
  assert.equal(result.props.initialCampaign.name, campaign.name)
  available = false
  await assert.rejects(page(), /NOT_FOUND/)
})

test("manufacturer initial HTML contains its public product, heading and product-specific warranty information", () => {
  for (const brand of ["bosch", "haier", "lg", "tcl"]) {
    const loader = sourceLoader({
      "@/components/Header": () => null,
      "@/components/Footer": () => null,
      "@/components/CategoryProductCard": ({ product }) => createElement("span", null, product.name),
    })
    const Client = loader.load(`app/${brand}/BrandClient.tsx`).default
    const html = renderToStaticMarkup(createElement(Client, { initialProducts: [{ id: "fixture", name: "Public fixture appliance", price: 100, stock: 5 }] }))
    assert.match(html, /Public fixture appliance/)
    assert.match(html, /<h1(?:\s|>)/)
    assert.ok(html.includes('href="/warranty"'))
    assert.doesNotMatch(html, /(?:2|3|10) Year Warranty|On All Products/)
    assert.doesNotMatch(html, /opacity-0 -translate-x-10/)
  }
})
