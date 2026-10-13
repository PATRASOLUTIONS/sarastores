import { getCollection } from "@/lib/db-service"
import { getStoreSettings, pickStoreName } from "@/lib/jsonld-store"
import { getOriginFromHeaders } from "@/lib/seo-metadata"

export const revalidate = 3600
export const dynamic = "force-dynamic"

interface IndexEntry {
  name?: string | null
  slug?: string | null
  description?: string | null
  tagline?: string | null
  price?: number | null
  mrp?: number | null
  stock?: number | null
  brand?: string | null
}

function text(value: unknown, max = 140): string {
  if (typeof value !== "string") return ""
  return value.replace(/<[^>]*>/g, "").replace(/[\\`*_{}\[\]()<>#!|]/g, "").replace(/\s+/g, " ").trim().slice(0, max)
}

export async function GET() {
  const [origin, settings] = await Promise.all([getOriginFromHeaders(), getStoreSettings()])
  const name = text(pickStoreName(settings), 120)
  const lines = [
    `# ${name}`,
    `> ${text(settings?.storeDescription || "Genuine electronics, appliances, smartphones and TVs with delivery across India.")}`,
    "",
    `Selected first-party catalogue links for ${name}. Excerpts are bounded; use the sitemap for the complete index.`,
    `- Store URL: <${origin}>`,
    `- Sitemap: <${origin}/sitemap.xml>`,
  ]
  if (settings?.email && settings.email.length <= 255 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(settings.email)) lines.push(`- Contact: <mailto:${settings.email}>`)
  if (settings?.phone) lines.push(`- Phone: ${text(settings.phone, 40)}`)
  lines.push("", "## Storefront",
    `- [All products](${origin}/products)`, `- [All brands](${origin}/brands)`,
    `- [Store locator](${origin}/store-locator)`, `- [Offers](${origin}/offers)`,
    "", "## Policies",
    `- [Privacy policy](${origin}/privacy-policy)`, `- [Terms and conditions](${origin}/terms-and-conditions)`,
    `- [Cancellation policy](${origin}/cancellation-policy)`, `- [Complaints](${origin}/complaints)`,
  )
  const address = settings?.address
  if (address) {
    const parts = [address.street, address.city, address.state, address.postalCode, address.country].map(part => text(part, 120)).filter(Boolean)
    if (parts.length) lines.push("", "## Address", ...parts.map(part => `- ${part}`))
  }
  const hours = settings?.hours || settings?.openingHours
  if (hours) lines.push("", "## Hours", ...(Array.isArray(hours) ? hours.slice(0, 7) : [hours]).map(hour => `- ${text(hour, 120)}`))

  let catalogueUnavailable = false
  const sections: Array<{ heading: string; entries: string[] }> = []
  try {
    const [products, categories, brands] = await Promise.all([
      (await getCollection<IndexEntry>("products")).find({ active: true }, {
        projection: { name: 1, slug: 1, brand: 1, price: 1, mrp: 1, description: 1, stock: 1 },
      }).sort({ updatedAt: -1 }).limit(60).toArray(),
      (await getCollection<IndexEntry>("categories")).find({ isEnabled: { $ne: false } }, {
        projection: { name: 1, slug: 1, description: 1 },
      }).limit(30).toArray(),
      (await getCollection<IndexEntry>("brands")).find({
        enabled: { $ne: false }, isEnabled: { $ne: false }, active: { $ne: false }, landingPageEnabled: { $ne: false },
        slug: { $type: "string", $ne: "" },
      }, { projection: { name: 1, slug: 1, description: 1, tagline: 1 } }).limit(30).toArray(),
    ])
    const link = (entry: IndexEntry & { _id: { toString(): string } }, path: string) => {
      const slug = typeof entry.slug === "string" && entry.slug.trim() ? entry.slug.trim() : entry._id.toString()
      return `- [${text(entry.name, 120) || path}](${origin}/${path}/${encodeURIComponent(slug)})`
    }
    sections.push(
      { heading: "## Categories", entries: categories.map(entry => `${link(entry, "category")}${entry.description ? `: ${text(entry.description)}` : ""}`) },
      { heading: "## Brand pages", entries: brands.map(entry => `${link(entry, "brands")}${entry.description || entry.tagline ? `: ${text(entry.description || entry.tagline)}` : ""}`) },
      { heading: "## Products", entries: products.map(entry => {
        const price = typeof entry.price === "number" && Number.isFinite(entry.price) && entry.price > 0 ? ` INR ${entry.price.toLocaleString("en-IN")}` : ""
        const mrp = price && typeof entry.mrp === "number" && Number.isFinite(entry.mrp) && entry.mrp > (entry.price || 0) ? ` (MRP INR ${entry.mrp.toLocaleString("en-IN")})` : ""
        const stock = typeof entry.stock === "number" && Number.isFinite(entry.stock) ? entry.stock > 0 ? " - In stock" : " - Out of stock" : ""
        const brand = text(entry.brand, 80)
        const description = text(entry.description, 110)
        return `${link(entry, "product")}${price}${mrp}${brand ? ` - ${brand}` : ""}${stock}${description ? `: ${description}` : ""}`
      }) },
    )
  } catch (error) {
    catalogueUnavailable = true
    console.error("[SEO] llms.txt catalogue could not be loaded:", error instanceof Error ? error.message : "Unexpected database failure")
    lines.push("", "Catalogue data is temporarily unavailable. Retry later; no empty catalogue is implied.")
  }

  // Reserve the fixed storefront/policy content, then fit complete links by UTF-8 bytes.
  const maxBytes = 10000
  let bytes = Buffer.byteLength(lines.join("\n"), "utf8")
  if (bytes > maxBytes) {
    console.error("[SEO] llms.txt public configuration exceeds the output budget")
    return new Response("Public index configuration requires administrator reconciliation.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  }
  for (const [index, section] of sections.entries()) {
    const heading = `\n\n${section.heading}`
    const reserved = sections.slice(index + 1).reduce((sum, next) => next.entries.length
      ? sum + Buffer.byteLength(`\n\n${next.heading}\n${next.entries[0]}`, "utf8") : sum, 0)
    const sectionLimit = maxBytes - reserved
    if (!section.entries.length || bytes + Buffer.byteLength(`${heading}\n${section.entries[0]}`, "utf8") > sectionLimit) continue
    lines.push("", section.heading)
    bytes += Buffer.byteLength(heading, "utf8")
    for (const entry of section.entries) {
      const size = Buffer.byteLength(`\n${entry}`, "utf8")
      if (bytes + size > sectionLimit) break
      lines.push(entry)
      bytes += size
    }
  }
  return new Response(lines.join("\n"), {
    status: catalogueUnavailable ? 503 : 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": catalogueUnavailable ? "no-store" : "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "X-Catalogue-Status": catalogueUnavailable ? "unavailable" : "available",
    },
  })
}
