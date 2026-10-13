/**
 * CategoryJsonLdServer — Server-rendered BreadcrumbList + ItemList JSON-LD
 * for category pages. Fetches data server-side for guaranteed initial HTML.
 */

import { connectToDatabase } from "@/lib/mongodb"
import { safeJsonLd } from "@/lib/jsonld-safe"
import { getSeoCategory } from "@/lib/seo-category"
import { titleCaseLabel } from "@/lib/product-display"
import { cleanProductName } from "@/utils/cleanProductName"

async function getCategoryProducts(categoryName: string) {
  try {
    const { db } = await connectToDatabase()

    const category = await getSeoCategory(categoryName)

    if (!category) return { category: null, products: [] }

    // Products store the category as a name; older rows may still hold an id.
    const products = await db
      .collection('products')
      .find({
        active: { $ne: false },
        $or: [{ category: category.name }, { groupName: category.name }, { category: category.id }],
      })
      .project({ _id: 1, id: 1, slug: 1, name: 1 })
      .limit(50)
      .toArray()

    return { category, products }
  } catch (error) {
    console.error('[SEO] Category structured data could not be loaded:', error)
    return { category: null, products: [] }
  }
}

export async function CategoryJsonLdServer({
  categoryName,
  origin,
}: {
  categoryName: string
  origin: string
}) {
  const { category, products } = await getCategoryProducts(categoryName)

  if (!category) return null
  const displayName = titleCaseLabel(String(category.name))
  const pageUrl = `${origin}/category/${encodeURIComponent(category.slug || category.id)}`

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      { "@type": "ListItem", position: 2, name: "Products", item: `${origin}/products` },
      { "@type": "ListItem", position: 3, name: displayName, item: pageUrl },
    ],
  }

  const itemListData = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: displayName,
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
