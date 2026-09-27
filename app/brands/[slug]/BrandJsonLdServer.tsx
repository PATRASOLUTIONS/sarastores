/**
 * BrandJsonLdServer — Server-rendered Brand + Breadcrumb JSON-LD
 * for brand pages. Fetches data server-side for guaranteed initial HTML.
 */

import { connectToDatabase } from "@/lib/mongodb"

async function getBrand(slug: string) {
  try {
    const { db } = await connectToDatabase()
    return await db.collection('brands').findOne({
      slug,
      enabled: { $ne: false },
      isEnabled: { $ne: false },
      active: { $ne: false },
    })
  } catch {
    return null
  }
}

async function getBrandProducts(brandName: string) {
  try {
    const { db } = await connectToDatabase()
    const products = await db
      .collection('products')
      .find({ active: true })
      .project({ _id: 1, id: 1, name: 1, brand: 1, manufacturer: 1 })
      .toArray()

    // Filter by brand name
    return products.filter((p: any) => {
      const manufacturer = p.brand || p.manufacturer || ""
      return manufacturer.toLowerCase().includes(brandName.toLowerCase())
    }).slice(0, 50)
  } catch {
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

  const brandData: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: brand.name,
    url: `${origin}/brands/${slug}`,
  }
  if (brand.logo) brandData.logo = brand.logo
  if (brand.description) brandData.description = brand.description

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      { "@type": "ListItem", position: 2, name: "Brands", item: `${origin}/brands` },
      { "@type": "ListItem", position: 3, name: brand.name },
    ],
  }

  // Get products for ItemList
  const products = await getBrandProducts(brand.name)
  const itemListData = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${brand.name} Products`,
    numberOfItems: products.length,
    itemListElement: products.map((p: any, idx: number) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${origin}/product/${p.id || p._id}`,
      name: p.name,
    })),
  } : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      {itemListData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }}
        />
      )}
    </>
  )
}
