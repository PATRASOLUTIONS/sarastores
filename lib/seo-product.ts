import { cache } from "react"
import { getCollection } from "@/lib/db-service"
import { getReviewProduct, publishedReviewFilter } from "@/lib/reviews"
import { getProductCommerceAttributes } from "@/lib/product-attributes"
import { getCatalogMRP } from "@/lib/product-display"
import { productImageUrls } from "@/lib/product-images"
import { cleanProductDescription, cleanProductName } from "@/utils/cleanProductName"
import { seoText } from "@/lib/seo-metadata"
import type { ObjectId } from "mongodb"
import { isPublicProduct } from "@/lib/product-visibility"

export interface ProductFeedDocument extends Record<string, unknown> {
  _id: ObjectId | string
  name?: string
  slug?: string
  description?: string | null
  price?: number | string | null
  mrp?: number | string | null
  image?: string | null
  images?: string[] | null
  sku?: string
  brand?: string | null
  category?: string | null
  stock?: number | string | null
  createdAt?: Date | string | number | null
  updatedAt?: Date | string | number | null
}

export const getSeoProduct = cache(async (identifier: string) => {
  identifier = decodeURIComponent(identifier)
  const product = await getReviewProduct(identifier)
  if (!isPublicProduct(product)) return null
  const specs = product.sku
    ? await (await getCollection("product_specifications")).findOne({ sku: product.sku })
    : null
  const attributes = getProductCommerceAttributes(product)
  const reviews = await getCollection("reviews")
  const [rating] = await reviews.aggregate<{ count: number; average: number }>([
    { $match: { $and: [publishedReviewFilter(String(product.id)), { rating: { $type: "number", $gte: 1, $lte: 5 } }] } },
    { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } },
  ]).toArray()
  const price = Number(product.price)
  return {
    id: String(product.id),
    slug: typeof product.slug === "string" && product.slug ? product.slug : String(product.id),
    name: cleanProductName(product.name),
    description: seoText(cleanProductDescription(product.description)),
    images: productImageUrls([
      ...(Array.isArray(product.images) ? product.images : []),
      product.image,
      specs?.specification_images || product.specification_images,
    ]),
    price: Number.isFinite(price) && price > 0 ? price : null,
    mrp: getCatalogMRP({ ...product, mrp: product.mrp || specs?.mrp }),
    inStock: typeof product.stock === "number" ? product.stock > 0 : product.inStock !== false,
    brand: String(product.manufacturerName || product.manufacturer_name || product.brand || ""),
    category: String(product.category || product.groupName || ""),
    sku: typeof product.sku === "string" ? product.sku : undefined,
    attributes,
    rating: rating?.count ? { average: rating.average, count: rating.count } : null,
    updatedAt: product.updatedAt ? new Date(product.updatedAt) : null,
  }
})
