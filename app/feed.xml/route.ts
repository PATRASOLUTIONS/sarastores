import { connectToDatabase } from "@/lib/mongodb"

export const revalidate = 3600

function getOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

export async function GET() {
  const origin = getOrigin()

  let products: any[] = []

  try {
    const { db } = await connectToDatabase()
    products = await db
      .collection("products")
      .find({ active: true }, { projection: { name: 1, slug: 1, description: 1, price: 1, image: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray()
  } catch {
    // DB unavailable — return empty feed
  }

  const items = products.map((p) => {
    const slug = p.slug || p._id?.toString() || ""
    const url = `${origin}/product/${slug}`
    const desc = (p.description || "").replace(/<[^>]*>/g, "").slice(0, 300)

    return `    <item>
      <title>${escapeXml(p.name || "Product")}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(desc || `Shop ${p.name} online at best prices.`)}</description>
      <pubDate>${p.updatedAt ? new Date(p.updatedAt).toUTCString() : new Date().toUTCString()}</pubDate>
    </item>`
  }).join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sara Electronics — Latest Products</title>
    <link>${origin}</link>
    <description>Browse the latest electronics, appliances, and more at Sara Electronics.</description>
    <language>en-IN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml" />
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
