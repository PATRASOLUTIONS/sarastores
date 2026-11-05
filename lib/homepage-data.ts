import { cache } from "react"
import { getCollection, normalizeId } from "@/lib/db-service"
import { cachePublicData } from "@/lib/public-data-cache"
import { getHomepageProductPool, getHomepageHeroProducts } from "@/lib/public-page-data"
import { uniquePublicProductNames } from "@/lib/public-product-names"
import { marketingResponseSchema } from "@/lib/marketing-content"
import { siteBannerListResponseSchema } from "@/lib/site-banners"
import type { HomeProduct } from "@/components/home/landing/HomepageSections"
import type { BannerImageDocument } from "@/lib/banner-images"

const readHomepageContent = cachePublicData(async () => {
  const [banners, marketing, storeCount] = await Promise.all([
    getCollection("listing_banners").then(collection => collection.find({
      active: true, placement: { $in: ["home-hero", "home-duo", "home-strip", "home-card", "home-statement"] },
    }).sort({ order: 1, createdAt: 1 }).toArray()),
    getCollection("marketing_content").then(collection => collection.find({}).toArray()),
    getCollection("stores").then(collection => collection.countDocuments({})),
  ])
  const imageIds = banners.flatMap(banner => {
    const match = String(banner.image || "").match(/\/api\/banner-images\/([a-f0-9]{32})$/)
    return match ? [match[1]] : []
  })
  const dimensions = imageIds.length ? await (await getCollection<Pick<BannerImageDocument, "_id" | "width" | "height">>("banner_images")).find({ _id: { $in: imageIds } }, {
    projection: { width: 1, height: 1 },
  }).toArray() : []
  const byId = new Map(dimensions.map(image => [String(image._id), image]))
  const heroProducts = banners.some(banner => /iphone\s*16/i.test(String(banner.title))) ? await getHomepageHeroProducts() : []
  return {
    banners: siteBannerListResponseSchema.parse(banners.map(banner => {
      const image = byId.get(String(banner.image || "").split("/").pop() || "")
      return { ...normalizeId(banner), ...(image ? { imageWidth: image.width, imageHeight: image.height } : {}) }
    })),
    marketing: marketingResponseSchema.parse({ sections: marketing.map(normalizeId) }),
    storeCount,
    heroProducts: heroProducts.map(product => ({ id: product.id, name: product.name, price: product.price, stock: product.stock, image: product.image })),
  }
}, 60_000)

// Share a validated public snapshot across homepage renders within a request.
export const getHomepageContent = cache(readHomepageContent)
export type HomepageContent = Awaited<ReturnType<typeof getHomepageContent>>

export async function getHomepageDeals(): Promise<HomeProduct[]> {
  const candidates = uniquePublicProductNames((await getHomepageProductPool()).filter(product => (product.stock ?? 0) > 0 && product.price > 0))
  for (let index = 0; index < Math.min(6, candidates.length); index++) {
    const picked = index + Math.floor(Math.random() * (candidates.length - index))
    const product = candidates[index]
    candidates[index] = candidates[picked]
    candidates[picked] = product
  }
  // The browser needs only card fields, never the sampled pool or raw metadata.
  return candidates.slice(0, 6).map(product => ({
    id: product.id, name: product.name, image: product.image, price: product.price,
    stock: product.stock ?? 0, mrp: product.mrp, slug: product.slug,
    category: product.category, subCategory: product.subCategory ?? undefined,
    brand: product.brand, rating: product.rating || (typeof product.reviews === "object" ? product.reviews?.average : undefined),
    reviewsCount: product.reviewsCount || (typeof product.reviews === "object" ? product.reviews?.count : product.reviews),
  }))
}
