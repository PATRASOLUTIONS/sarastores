/**
 * BrandJsonLdServer — Server-rendered Brand + Breadcrumb JSON-LD
 * for brand pages. Fetches data server-side for guaranteed initial HTML.
 */

import { connectToDatabase } from "@/lib/mongodb"
import { safeJsonLd } from "@/lib/jsonld-safe"
import { absoluteSeoImage } from "@/lib/seo-metadata"
import { normalizeProductForSchema } from "@/lib/product-schema"
import { cleanProductName } from "@/utils/cleanProductName"
import { getSeoBrand as getBrand } from "@/lib/seo-brand"
import type { ObjectId } from "mongodb"

interface BrandProductDocument {
  _id: ObjectId | string
  slug?: string
  name: string
  brand?: string
  manufacturer?: string
  manufacturerName?: string
  manufacturer_name?: string
  raw?: Record<string, unknown>
  active?: boolean
}

async function getBrandProducts(brandName: string, limit: number) {
  try {
    const { db } = await connectToDatabase()
    const products = await db
      .collection<BrandProductDocument>('products')
      .find({ active: { $ne: false } })
      .project({ _id: 1, id: 1, slug: 1, name: 1, brand: 1, manufacturer: 1, manufacturerName: 1, manufacturer_name: 1, raw: 1 })
      .toArray()

    // Filter by brand name
    return products.filter((p) => {
      const manufacturer = normalizeProductForSchema(p).manufacturerName || p.brand || p.manufacturer || ""
      return manufacturer.toLowerCase().includes(brandName.toLowerCase())
    }).slice(0, limit)
  } catch (error) {
    console.error('[SEO] Brand products could not be loaded:', error)
    return []
  }
}

export async function BrandJsonLdServer({
  slug,
  origin,
}: {
  slug: string
  origin: string
}) {
  const brand = await getBrand(slug)
  if (!brand) return null

  const brandData = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: brand.name,
    url: `${origin}/brands/${slug}`,
    ...(brand.logo ? { logo: absoluteSeoImage(brand.logo, origin) } : {}),
    ...(brand.description ? { description: brand.description } : {}),
  }

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      { "@type": "ListItem", position: 2, name: "Brands", item: `${origin}/brands` },
      { "@type": "ListItem", position: 3, name: brand.name, item: `${origin}/brands/${encodeURIComponent(slug)}` },
    ],
  }

  // Get products for ItemList
  const products = await getBrandProducts(brand.productsSection?.manufacturerFilter || brand.name, brand.productsSection?.maxProducts || 12)
  const itemListData = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${brand.name} Products`,
    numberOfItems: products.length,
    itemListElement: products.map((p, idx: number) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${origin}/product/${encodeURIComponent(p.slug || p._id.toString())}`,
      name: cleanProductName(p.name),
    })),
  } : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(brandData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbData) }}
      />
      {itemListData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListData) }}
        />
      )}
    </>
  )
}
