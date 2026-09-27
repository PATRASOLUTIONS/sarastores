import { connectToDatabase } from "@/lib/mongodb"
import { getStoreSettings, pickStoreName } from "@/lib/jsonld-store"
import { getOriginFromHeaders } from "@/lib/seo-metadata"

export const revalidate = 3600
export const dynamic = "force-dynamic"

function mdEscape(text: string | null | undefined): string {
  if (!text) return ""
  return text.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim()
}

function shortDesc(text: string | undefined, max = 140): string {
  if (!text) return ""
  const stripped = mdEscape(text)
  return stripped.length <= max ? stripped : stripped.slice(0, max - 1).trimEnd() + "…"
}

export async function GET() {
  const [origin, settings] = await Promise.all([
    getOriginFromHeaders(),
    getStoreSettings(),
  ])
  const storeName = pickStoreName(settings)
  const tagline =
    settings?.storeDescription ||
    "Buy genuine electronics, home appliances, smartphones, TVs and more online at best prices with fast delivery across India."

  const lines: string[] = []
  lines.push(`# ${storeName}`)
  lines.push(`> ${mdEscape(tagline)}`)
  lines.push("")

  let products: any[] = []
  let categories: any[] = []
  let brands: any[] = []

  try {
    const { db } = await connectToDatabase()
    const [pRes, cRes, bRes] = await Promise.all([
      db.collection("products").find({ active: { $ne: false } }, { projection: { name: 1, slug: 1, brand: 1, price: 1, mrp: 1, description: 1, stock: 1 } }).sort({ updatedAt: -1 }).limit(50).toArray(),
      db.collection("categories").find({ isEnabled: { $ne: false } }, { projection: { name: 1, slug: 1, description: 1 } }).limit(30).toArray(),
      db.collection("brands").find({ enabled: true }, { projection: { name: 1, slug: 1, description: 1 } }).limit(30).toArray(),
    ])
    products = pRes
    categories = cRes
    brands = bRes
  } catch {
    // DB unavailable
  }

  if (categories.length) {
    lines.push("## Categories")
    for (const c of categories) {
      const slug = c.slug || c._id?.toString()
      if (!slug) continue
      const desc = shortDesc(c.description)
      lines.push(desc ? `- [${mdEscape(c.name)}](${origin}/category/${slug}): ${desc}` : `- [${mdEscape(c.name)}](${origin}/category/${slug})`)
    }
    lines.push("")
  }

  if (brands.length) {
    lines.push("## Brand pages")
    for (const b of brands) {
      const slug = b.slug || b._id?.toString()
      if (!slug) continue
      const desc = shortDesc(b.description || b.tagline)
      lines.push(desc ? `- [${mdEscape(b.name)}](${origin}/brands/${slug}): ${desc}` : `- [${mdEscape(b.name)}](${origin}/brands/${slug})`)
    }
    lines.push("")
  }

  if (products.length) {
    lines.push("## Products")
    for (const p of products) {
      const slugOrId = p.slug || p._id?.toString()
      if (!slugOrId) continue
      const price = typeof p.price === "number" && p.price > 0 ? `₹${p.price.toLocaleString("en-IN")}` : ""
      const desc = shortDesc(p.description, 110)
      lines.push(desc ? `- [${mdEscape(p.name)}](${origin}/product/${slugOrId})${price ? ` — ${price}` : ""}: ${desc}` : `- [${mdEscape(p.name)}](${origin}/product/${slugOrId})${price ? ` — ${price}` : ""}`)
    }
    lines.push("")
  }

  lines.push("## Storefront")
  lines.push(`- [All products](${origin}/products)`)
  lines.push(`- [All brands](${origin}/brands)`)
  lines.push("")

  lines.push("## Policies")
  lines.push(`- [Privacy policy](${origin}/privacy-policy)`)
  lines.push(`- [Terms and conditions](${origin}/terms-and-conditions)`)
  lines.push("")

  const body = lines.join("\n")

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
