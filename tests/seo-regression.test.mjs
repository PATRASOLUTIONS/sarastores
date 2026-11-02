import assert from "node:assert/strict"
import test from "node:test"
import { loader, origin, product, productSchemas, sitemapEntries } from "../scripts/seo/fixtures.mjs"

test("metadata uses one clean canonical and aligned sharing fields", () => {
  const build = loader().load("lib/seo-metadata.ts").buildPageMetadata
  const input = { title: "<b>Synthetic phone</b>", description: "Safe &amp; useful", pageUrl: `${origin}/product/test?sort=price#details`, origin, companyName: "Sara", imageUrl: "/photo.webp" }
  const before = JSON.stringify(input), metadata = build(input)
  assert.equal(metadata.alternates.canonical, `${origin}/product/test`)
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical)
  assert.equal(metadata.openGraph.title, "Synthetic phone")
  assert.equal(metadata.twitter.description, "Safe & useful")
  assert.equal(metadata.openGraph.images[0].url, `${origin}/photo.webp`)
  assert.equal(metadata.openGraph.images[0].width, undefined)
  assert.equal(JSON.stringify(input), before)
})

test("private metadata remains noindex and unusable sharing images fall back to PNG", () => {
  const build = loader().load("lib/seo-metadata.ts").buildPageMetadata
  for (const imageUrl of ["data:image/png;base64,FAKE", "/logo.svg", "javascript:alert(1)"]) {
    const metadata = build({ title: "Private", description: "Synthetic", pageUrl: "/account", origin, companyName: "Sara", noIndex: true, imageUrl })
    assert.equal(metadata.robots.index, false)
    assert.equal(metadata.robots.follow, false)
    assert.equal(metadata.openGraph.images[0].type, "image/png")
    assert.ok(metadata.openGraph.images[0].url.startsWith(`${origin}/og?`))
  }
})

test("Product markup uses fixture money, policy, brand and clean breadcrumb URL", async () => {
  const [schema, breadcrumb] = await productSchemas()
  assert.equal(schema["@type"], "Product")
  assert.equal(schema.offers["@type"], "Offer")
  assert.equal(schema.offers.price, 12000)
  assert.equal(schema.offers.priceCurrency, "INR")
  assert.equal(schema.offers.shippingDetails.shippingRate.value, 100)
  assert.equal(schema.offers.shippingDetails.shippingDestination.addressCountry, "IN")
  assert.equal(schema.offers.hasMerchantReturnPolicy.merchantReturnLink, `${origin}/returns`)
  assert.equal(schema.offers.hasMerchantReturnPolicy.merchantReturnDays, undefined)
  assert.equal(schema.offers.hasMerchantReturnPolicy.returnMethod, undefined)
  assert.equal(schema.offers.shippingDetails.deliveryTime, undefined)
  assert.equal(schema.brand.name, "Synthetic Brand")
  assert.equal(schema.aggregateRating, undefined)
  assert.equal(breadcrumb.itemListElement.at(-1).item, schema.offers.url)
})

test("unavailable product emits no markup; missing price does not invent an offer", async () => {
  assert.equal((await productSchemas({ "@/lib/seo-product": { getSeoProduct: async () => null } })).length, 0)
  const [schema] = await productSchemas({ "@/lib/seo-product": { getSeoProduct: async () => ({ ...product, price: null, inStock: false }) } })
  assert.equal(schema.offers, undefined)
  assert.equal(schema.aggregateRating, undefined)
})

test("JSON-LD escaping prevents product text from closing the script element", async () => {
  const unsafe = { ...product, name: '</script><script>alert("fixture")</script>' }
  const output = await loader({ "@/lib/seo-product": { getSeoProduct: async () => unsafe } })
    .load("app/product/[slug]/ProductJsonLdServer.tsx").ProductJsonLdServer({ slug: unsafe.slug, origin })
  const raw = output.props.children[0].props.dangerouslySetInnerHTML.__html
  assert.ok(!raw.includes("</script>"))
  assert.equal(JSON.parse(raw).name, unsafe.name)
})

test("sitemap preserves dates, encodes identifiers and excludes private/query URLs", async () => {
  const entries = await sitemapEntries()
  assert.equal(new Set(entries.map(entry => entry.url)).size, entries.length)
  assert.ok(entries.every(entry => entry.url.startsWith(origin) && !new URL(entry.url).search))
  assert.ok(!entries.some(entry => /^\/(account|admin|checkout|cart|order|vendor)(\/|$)/.test(new URL(entry.url).pathname)))
  assert.equal(entries.find(entry => entry.url === `${origin}/product/${product.slug}`).lastModified.toISOString(), "2026-10-01T00:00:00.000Z")
  assert.equal(entries.find(entry => entry.url === `${origin}/`).lastModified, undefined)
  assert.equal(entries.find(entry => entry.url === `${origin}/product/id%20fallback`).images, undefined)
  assert.ok(entries.some(entry => entry.url === `${origin}/sub-category/Smart%20Phones`))
  assert.ok(entries.some(entry => entry.url === `${origin}/stores/synthetic-city/synthetic-store`))
})

test("robots declares the canonical sitemap and protects facets and private areas", async () => {
  const robots = await loader({ "@/lib/seo-metadata": { getOriginFromHeaders: async () => origin } }).load("app/robots.ts").default()
  const general = robots.rules.find(rule => rule.userAgent === "*")
  assert.equal(robots.sitemap, `${origin}/sitemap.xml`)
  for (const route of ["/checkout", "/account", "/order", "/admin", "/api"]) assert.ok(general.disallow.includes(route))
  assert.ok(general.disallow.includes("/*?*sort="))
  assert.ok(general.allow.includes("/api/media/brand-logo/"))
})
