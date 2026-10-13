import type { MetadataRoute } from "next"
import { getCollection } from "@/lib/db-service"
import { getAllStoreLocations } from "@/lib/store-locations"
import { listArticles } from "@/lib/articles"
import { absoluteSeoImage, getOriginFromHeaders } from "@/lib/seo-metadata"
import { productImageUrls } from "@/lib/product-images"

export const revalidate = 3600

const STATIC_PATHS = [
  "/", "/products", "/brands", "/about", "/contact", "/careers", "/press",
  "/returns", "/shipping-policy", "/warranty", "/installation", "/emi",
  "/business-enquiries", "/corporate-information", "/disclaimer", "/sitemap",
  "/privacy-policy", "/terms-and-conditions", "/cancellation-policy", "/complaints",
  "/store-locator", "/stores", "/offers", "/ganesh", "/blog", "/faq", "/rewards", "/lucky-draw",
  "/software", "/brand-guidelines", "/bosch", "/haier", "/lg", "/tcl", "/epic-sale",
]

function modifiedAt(value: unknown): Date | undefined {
  if (!(typeof value === "string" || typeof value === "number" || value instanceof Date)) return undefined
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getOriginFromHeaders()
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(path => ({
    url: new URL(path, origin).href,
    changeFrequency: path === "/" || path === "/products" ? "daily" : "monthly",
    priority: path === "/" ? 1 : path === "/products" ? 0.9 : 0.5,
  }))
  const appendCollection = async (name: string, operation: () => Promise<MetadataRoute.Sitemap>) => {
    try { entries.push(...await operation()) }
    catch (error) { console.error(`[SEO] Sitemap ${name} entries could not be loaded:`, error) }
  }

  await appendCollection("products", async () => {
    const products = await (await getCollection("products")).find({ active: true }, {
      projection: { slug: 1, updatedAt: 1, createdAt: 1, image: 1, images: 1 },
    }).toArray()
    return products.map(product => {
      const images = productImageUrls([product.image, product.images])
        .map(image => absoluteSeoImage(image, origin))
        .filter((image): image is string => Boolean(image?.startsWith("https://"))).slice(0, 5)
      return {
        url: `${origin}/product/${encodeURIComponent(product.slug || product._id.toString())}`,
        lastModified: modifiedAt(product.updatedAt || product.createdAt),
        changeFrequency: "weekly", priority: 0.7,
        ...(images.length && { images }),
      }
    })
  })
  await appendCollection("categories", async () => {
    const categories = await (await getCollection("categories")).find({ isEnabled: { $ne: false } }, {
      projection: { slug: 1, updatedAt: 1, createdAt: 1 },
    }).toArray()
    return categories.map(category => ({
      url: `${origin}/category/${encodeURIComponent(category.slug || category._id.toString())}`,
      lastModified: modifiedAt(category.updatedAt || category.createdAt),
      changeFrequency: "weekly", priority: 0.7,
    }))
  })
  await appendCollection("sub-categories", async () => {
    const categories = await (await getCollection("sub_categories")).find({ active: { $ne: false } }, {
      projection: { name: 1, updatedAt: 1, createdAt: 1 },
    }).toArray()
    return categories.filter(category => typeof category.name === "string" && category.name.trim()).map(category => ({
      url: `${origin}/sub-category/${encodeURIComponent(category.name)}`,
      lastModified: modifiedAt(category.updatedAt || category.createdAt),
      changeFrequency: "weekly", priority: 0.6,
    }))
  })
  await appendCollection("brands", async () => {
    const brands = await (await getCollection("brands")).find({
      enabled: { $ne: false }, isEnabled: { $ne: false }, active: { $ne: false }, landingPageEnabled: { $ne: false },
      slug: { $type: "string", $ne: "" },
    }, { projection: { slug: 1, updatedAt: 1, createdAt: 1 } }).toArray()
    return brands.map(brand => ({
      url: `${origin}/brands/${encodeURIComponent(brand.slug)}`,
      lastModified: modifiedAt(brand.updatedAt || brand.createdAt),
      changeFrequency: "weekly", priority: 0.8,
    }))
  })
  await appendCollection("stores", async () => {
    const stores = await getAllStoreLocations()
    return [
      ...Array.from(new Set(stores.map(store => store.citySlug)), city => ({
        url: `${origin}/stores/${city}`, changeFrequency: "monthly" as const, priority: 0.7,
      })),
      ...stores.map(store => ({
        url: `${origin}/stores/${store.citySlug}/${store.slug}`,
        changeFrequency: "monthly" as const, priority: 0.6,
      })),
    ]
  })
  await appendCollection("campaigns", async () => {
    const campaigns = await (await getCollection("campaign_pages")).find({
      isActive: true, slug: { $type: "string", $ne: "" },
    }, { projection: { slug: 1, updatedAt: 1, createdAt: 1 } }).toArray()
    return campaigns.map(campaign => ({
      url: `${origin}/campaign/${encodeURIComponent(campaign.slug)}`,
      lastModified: modifiedAt(campaign.updatedAt || campaign.createdAt),
      changeFrequency: "daily", priority: 0.6,
    }))
  })
  await appendCollection("articles", async () => (await listArticles()).filter(article => article.slug).map(article => ({
    url: `${origin}/blog/${encodeURIComponent(article.slug)}`,
    lastModified: modifiedAt(article.updatedAt || article.publishedAt || article.createdAt),
    changeFrequency: "monthly", priority: 0.6,
  })))
  return [...new Map(entries.map(entry => [entry.url, entry])).values()]
}
