/**
 * CategoryJsonLdServer — Server-rendered BreadcrumbList + ItemList JSON-LD
 * for category pages. Fetches data server-side for guaranteed initial HTML.
 */

import { connectToDatabase } from "@/lib/mongodb"

async function getCategoryProducts(categoryName: string) {
  try {
    const { db } = await connectToDatabase()

    const categories = await db.collection('categories').find({}).toArray()
    const category = categories.find(
      (c: any) =>
        c.name?.toLowerCase() === categoryName.toLowerCase() ||
        c.id === categoryName ||
        String(c._id) === categoryName,
    )

    if (!category) return { category: null, products: [] }

    // Products store the category as a name; older rows may still hold an id.
    const products = await db
      .collection('products')
      .find({
        active: true,
        $or: [{ category: category.name }, { groupName: category.name }, { category: category.id }],
      })
      .project({ _id: 1, id: 1, name: 1 })
      .limit(50)
      .toArray()

    return { category, products }
  } catch {
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

  const displayName = categoryName
    .split(/\s+/)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      { "@type": "ListItem", position: 2, name: "Products", item: `${origin}/products` },
      { "@type": "ListItem", position: 3, name: displayName },
    ],
  }

  const itemListData = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: displayName,
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
