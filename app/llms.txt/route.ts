/**
 * llms.txt — proposed standard (https://llmstxt.org) for LLM/AI agents.
 *
 * Served as text/plain at /llms.txt. Helps ChatGPT, Claude, Perplexity,
 * Google AI Overviews, Bing Copilot, and other AI systems ground their
 * product/store answers on first-party structured data instead of guessing
 * from raw HTML. Re-uses the same data sources as app/sitemap.ts so the
 * two stay in sync.
 *
 * Spec: # SiteName, > one-line summary, ## sections with markdown links.
 * Keep under ~5-10KB so it stays cheap for crawlers to ingest.
 */

import { connectToDatabase } from "@/lib/mongodb"
import { getStoreSettings, pickStoreName } from "@/lib/jsonld-store"
import { getOriginFromHeaders } from "@/lib/seo-metadata"

export const revalidate = 3600 // hourly, same cadence as sitemap
export const dynamic = "force-dynamic" // pulls from MongoDB

const MAX_PRODUCTS = 60
const MAX_CATEGORIES = 30
const MAX_BRANDS = 30

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
  lines.push(
    `This file is a machine-readable index of ${storeName}. It is served at ${origin}/llms.txt and is intended for AI assistants, search-engine AI Overviews, and crawlers that want to ground their answers in first-party data.`,
  )
  lines.push("")
  lines.push(`- Store URL: <${origin}>`)
  lines.push(
    `- Contact: <${settings?.email || `mailto:${settings?.email || "support@" + origin.replace(/^https?:\/\//, "")}`}>`,
  )
  if (settings?.phone) lines.push(`- Phone: ${settings.phone}`)
  lines.push("- Sitemap: <" + origin + "/sitemap.xml>")
  lines.push("- Human-readable sitemap: <" + origin + "/sitemap.xml>")
  lines.push("")

  // Try to load live data. Failures are non-fatal — the file still
  // represents the store at a "we don't know" level.
  let products: any[] = []
  let categories: any[] = []
  let brands: any[] = []
  let contactInfo: any = null

  try {
    const { db } = await connectToDatabase()
    const [pRes, cRes, bRes, contact] = await Promise.all([
      db
        .collection("products")
        .find(
          { active: { $ne: false } },
          {
            projection: {
              name: 1,
              slug: 1,
              brand: 1,
              category: 1,
              price: 1,
              mrp: 1,
              description: 1,
              stock: 1,
            },
          },
        )
        .sort({ updatedAt: -1 })
        .limit(MAX_PRODUCTS)
        .toArray(),
      db
        .collection("categories")
        .find(
          { isEnabled: { $ne: false } },
          { projection: { name: 1, slug: 1, description: 1 } },
        )
        .limit(MAX_CATEGORIES)
        .toArray(),
      db
        .collection("brands")
        .find(
          { enabled: true },
          { projection: { name: 1, slug: 1, description: 1 } },
        )
        .limit(MAX_BRANDS)
        .toArray(),
      db.collection("settings").findOne({}, { projection: { contact: 1, address: 1, hours: 1 } }),
    ])
    products = pRes
    categories = cRes
    brands = bRes
    contactInfo = contact
  } catch (e) {
    // DB unavailable — continue with empty lists.
  }

  // Categories
  if (categories.length) {
    lines.push("## Categories")
    for (const c of categories) {
      const slug = c.slug || c._id?.toString()
      if (!slug) continue
      const name = mdEscape(c.name) || "Category"
      const desc = shortDesc(c.description)
      lines.push(
        desc
          ? `- [${name}](${origin}/category/${slug}): ${desc}`
          : `- [${name}](${origin}/category/${slug})`,
      )
    }
    lines.push("")
  }

  // Brands
  if (brands.length) {
    lines.push("## Brand pages")
    for (const b of brands) {
      const slug = b.slug || b._id?.toString()
      if (!slug) continue
      const name = mdEscape(b.name) || "Brand"
      const desc = shortDesc(b.description || b.tagline)
      lines.push(
        desc
          ? `- [${name}](${origin}/brands/${slug}): ${desc}`
          : `- [${name}](${origin}/brands/${slug})`,
      )
    }
    lines.push("")
  }

  // Products
  if (products.length) {
    lines.push("## Products")
    for (const p of products) {
      const slugOrId = p.slug || p._id?.toString()
      if (!slugOrId) continue
      const name = mdEscape(p.name) || "Product"
      const price =
        typeof p.price === "number" && p.price > 0
          ? `₹${p.price.toLocaleString("en-IN")}`
          : ""
      const mrp =
        typeof p.mrp === "number" && p.mrp > 0 && p.mrp > (p.price || 0)
          ? ` (MRP ₹${p.mrp.toLocaleString("en-IN")})`
          : ""
      const stock =
        typeof p.stock === "number"
          ? p.stock > 0
            ? " — In stock"
            : " — Out of stock"
          : ""
      const brand = p.brand ? ` — ${mdEscape(p.brand)}` : ""
      const desc = shortDesc(p.description, 110)
      const meta = [price ? price + mrp : "", brand, stock].filter(Boolean).join("")
      lines.push(
        desc
          ? `- [${name}](${origin}/product/${slugOrId})${meta}: ${desc}`
          : `- [${name}](${origin}/product/${slugOrId})${meta}`,
      )
    }
    lines.push("")
  }

  // Storefront links
  lines.push("## Storefront")
  lines.push(`- [All products](${origin}/products)`)
  lines.push(`- [All brands](${origin}/brands)`)
  lines.push(`- [Store locator](${origin}/store-locator)`)
  lines.push(`- [Today's deals](${origin}/products?deals=true)`)
  lines.push("")

  // Customer / company info
  if (contactInfo?.address) {
    const a = contactInfo.address
    const parts = [a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean)
    if (parts.length) lines.push("## Address")
    for (const p of parts) lines.push(`- ${mdEscape(p)}`)
    if (parts.length) lines.push("")
  }
  if (contactInfo?.hours) {
    lines.push("## Hours")
    if (typeof contactInfo.hours === "string") {
      lines.push(`- ${mdEscape(contactInfo.hours)}`)
    } else if (Array.isArray(contactInfo.hours)) {
      for (const h of contactInfo.hours) lines.push(`- ${mdEscape(String(h))}`)
    }
    lines.push("")
  }

  // Policies
  lines.push("## Policies")
  lines.push(`- [Privacy policy](${origin}/privacy-policy)`)
  lines.push(`- [Terms and conditions](${origin}/terms-and-conditions)`)
  lines.push(`- [Cancellation policy](${origin}/cancellation-policy)`)
  lines.push(`- [Complaints](${origin}/complaints)`)
  lines.push("")

  // Optional brand-specific landing pages
  for (const b of brands.slice(0, 12)) {
    const slug = b.slug
    if (!slug) continue
    // The brand's first-party landing page (bosch/, haier/, lg/, tcl/…).
    lines.push(`- [${mdEscape(b.name)} landing](${origin}/${slug.toLowerCase()})`)
  }
  lines.push("")

  const body = lines.join("\n")

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
