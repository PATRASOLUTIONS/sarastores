import { connectToDatabase } from "@/lib/mongodb"
import { getCompanyName, getOriginFromHeaders, getSiteSettings, seoText } from "@/lib/seo-metadata"
import type { ProductFeedDocument } from "@/lib/seo-product"

export const revalidate = 3600

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

export async function GET() {
  const [origin, settings] = await Promise.all([getOriginFromHeaders(), getSiteSettings()])
  const companyName = getCompanyName(settings)

  let products: ProductFeedDocument[] = []

  try {
    const { db } = await connectToDatabase()
    products = await db
      .collection<ProductFeedDocument>("products")
      .find({ active: true }, { projection: { name: 1, slug: 1, description: 1, price: 1, image: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray()
  } catch (error) {
    console.error("[SEO] Product feed could not be loaded:", error)
    return new Response("Product feed is temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } })
  }

  const items = products.map((p) => {
    const slug = p.slug || p._id?.toString() || ""
    const url = escapeXml(`${origin}/product/${encodeURIComponent(slug)}`)
    const desc = seoText(p.description || "").slice(0, 300)
    const date = p.updatedAt || p.createdAt
    const publishedAt = date ? new Date(date) : null

    return `    <item>
      <title>${escapeXml(p.name || "Product")}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(desc || `Shop ${p.name} online at best prices.`)}</description>
      ${publishedAt && Number.isFinite(publishedAt.getTime()) ? `<pubDate>${publishedAt.toUTCString()}</pubDate>` : ""}
    </item>`
  }).join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(companyName)} — Latest Products</title>
    <link>${escapeXml(origin)}</link>
    <description>Browse the latest electronics and appliances at ${escapeXml(companyName)}.</description>
    <language>en-IN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(origin)}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
