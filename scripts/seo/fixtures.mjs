// Executes actual application SEO outputs with explicit synthetic infrastructure.
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { sourceLoader } from "../../tests/source-loader.mjs"

export const origin = "https://sarastores.com"
export const product = Object.freeze({
  id: "seo-fixture-1", slug: "synthetic-phone", sku: "SEO-FIXTURE-1",
  name: "Synthetic phone for SEO validation", description: "Synthetic product; never uploaded to Sara or Google.",
  images: ["/images/synthetic-phone.webp"], price: 12000, inStock: true,
  brand: "Synthetic Brand", category: "Phones", attributes: { mpn: "SEO-FIXTURE-MPN" }, rating: null,
})

export function loader(extra = {}) {
  return sourceLoader({
    "@/lib/seo-product": { getSeoProduct: async () => product },
    "@/lib/db-service": { getSettingsData: async () => ({ storeName: "Sara Stores" }) },
    "@/lib/order-pricing": { getShippingSettings: async () => ({ freeShippingThreshold: 15000, shippingFee: 100 }) },
    ...extra,
  }, { env: { NEXT_PUBLIC_SITE_URL: origin } })
}

export async function productSchemas(extra = {}) {
  const rendered = await loader(extra).load("app/product/[slug]/ProductJsonLdServer.tsx")
    .ProductJsonLdServer({ slug: product.slug, origin })
  if (!rendered) return []
  return rendered.props.children.map(script => JSON.parse(script.props.dangerouslySetInnerHTML.__html))
}

export async function sitemapEntries() {
  const collections = {
    products: [{ _id: "fixture-id", slug: product.slug, image: product.images[0], updatedAt: "2026-10-01T00:00:00Z" },
      { _id: "id fallback", image: "data:image/png;base64,FAKE" }],
    categories: [{ _id: "category-fixture", slug: "phones", createdAt: "2026-09-01T00:00:00Z" }],
    sub_categories: [{ name: "Smart Phones" }, { name: "" }],
    brands: [{ slug: "synthetic-brand" }],
    campaign_pages: [{ slug: "synthetic-campaign" }],
  }
  const snapshot = JSON.stringify(collections)
  const entries = await sourceLoader({
    "@/lib/db-service": { getCollection: async name => ({ find: () => ({ toArray: async () => collections[name] || [] }) }) },
    "@/lib/public-catalogue": { publicCatalogueFilter: async () => ({ active: true }) },
    "@/lib/store-locations": { getAllStoreLocations: async () => [{ citySlug: "synthetic-city", slug: "synthetic-store" }] },
    "@/lib/articles": { listArticles: async () => [{ slug: "synthetic-guide", publishedAt: "2026-10-01T00:00:00Z" }] },
    "@/lib/seo-metadata": { getOriginFromHeaders: async () => origin, absoluteSeoImage: loader().load("lib/seo-metadata.ts").absoluteSeoImage },
  }).load("app/sitemap.ts").default()
  if (JSON.stringify(collections) !== snapshot) throw new Error("Fixture inputs were modified")
  return entries
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")
}

export async function writeFixtures() {
  const output = path.resolve(".seo-local/fixtures")
  fs.mkdirSync(output, { recursive: true })
  const schemas = await productSchemas()
  fs.writeFileSync(path.join(output, "product.json"), JSON.stringify(schemas, null, 2))
  const entries = await sitemapEntries()
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' + entries.map(entry =>
    `<url><loc>${escapeXml(entry.url)}</loc>${entry.lastModified ? `<lastmod>${entry.lastModified.toISOString()}</lastmod>` : ""}${(entry.images || []).map(image => `<image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`).join("")}</url>`
  ).join("") + "</urlset>"
  fs.writeFileSync(path.join(output, "sitemap.xml"), xml)
  const metadata = loader().load("lib/seo-metadata.ts").buildPageMetadata({
    title: product.name, description: product.description, pageUrl: `${origin}/product/${product.slug}?utm_source=fixture`,
    origin, companyName: "Sara Stores", imageUrl: product.images[0],
  })
  fs.writeFileSync(path.join(output, "metadata.json"), JSON.stringify(metadata, null, 2))
  console.log(JSON.stringify({ synthetic: true, schemas: schemas.length, sitemapUrls: entries.length, output: ".seo-local/fixtures" }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await writeFixtures()
