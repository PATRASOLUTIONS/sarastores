import { connectToDatabase } from "@/lib/mongodb"
import { getProductCommerceAttributes } from "@/lib/product-attributes"
import { cleanProductName, cleanProductDescription } from "@/utils/cleanProductName"

/**
 * Google Merchant Center product feed (RSS 2.0 + the `g:` namespace).
 *
 * Generating the feed is local; submitting it requires a Merchant Center
 * account and domain verification — see docs/brd/PENDING-EXTERNAL-INTEGRATIONS.md
 * (EXT-01). Items without a GTIN fall back to brand + MPN, and items with
 * neither are marked `identifier_exists = no` so Google still accepts them.
 */

export const revalidate = 3600

// Merchant Center rejects feeds over 150k items; well above the current catalogue.
const MAX_ITEMS = 20000

function getOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function absoluteUrl(value: unknown, origin: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const url = value.trim()
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("data:")) return null
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  return `      <${name}>${escapeXml(String(value))}</${name}>\n`
}

export async function GET() {
  const origin = getOrigin()
  let products: any[] = []

  try {
    const { db } = await connectToDatabase()
    products = await db
      .collection("products")
      .find(
        { active: true },
        {
          projection: {
            name: 1,
            slug: 1,
            description: 1,
            price: 1,
            mrp: 1,
            image: 1,
            images: 1,
            brand: 1,
            category: 1,
            stock: 1,
            sku: 1,
            gtin: 1,
            mpn: 1,
            modelNumber: 1,
            weightKg: 1,
            warranty: 1,
            gstRate: 1,
            hsnCode: 1,
            seoTitle: 1,
            seoDescription: 1,
            free_delivery: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .limit(MAX_ITEMS)
      .toArray()
  } catch {
    // DB unavailable — emit a valid but empty feed rather than a 500, so
    // Merchant Center does not flag the feed URL as broken.
  }

  const items = products
    .map((product) => {
      const price = Number(product.price)
      if (!Number.isFinite(price) || price <= 0) return null

      const slug = product.slug || product._id?.toString()
      if (!slug) return null

      const imageUrl =
        absoluteUrl(product.image, origin) ??
        absoluteUrl(Array.isArray(product.images) ? product.images[0] : null, origin)
      if (!imageUrl) return null

      const attributes = getProductCommerceAttributes(product)
      const title = cleanProductName(product.name) || "Product"
      const description =
        attributes.seoDescription ||
        cleanProductDescription(product.description || "")?.slice(0, 5000) ||
        `Buy ${title} online at Sara Electronics.`

      const mrp = Number(product.mrp)
      const hasSalePrice = Number.isFinite(mrp) && mrp > price

      const additionalImages = (Array.isArray(product.images) ? product.images : [])
        .map((image: unknown) => absoluteUrl(image, origin))
        .filter((image: string | null): image is string => !!image && image !== imageUrl)
        .slice(0, 10)

      const hasIdentifier = !!(attributes.gtin || (product.brand && attributes.mpn))

      return (
        `    <item>\n` +
        tag("g:id", product.sku || slug) +
        tag("g:title", title.slice(0, 150)) +
        tag("g:description", description) +
        tag("g:link", `${origin}/product/${slug}`) +
        tag("g:image_link", imageUrl) +
        additionalImages.map((image: string) => tag("g:additional_image_link", image)).join("") +
        tag("g:availability", Number(product.stock) > 0 ? "in_stock" : "out_of_stock") +
        tag("g:condition", "new") +
        // Merchant Center requires `price` to be the strike-through value when
        // `sale_price` is present, so only send both when there is a real MRP.
        tag("g:price", `${(hasSalePrice ? mrp : price).toFixed(2)} INR`) +
        (hasSalePrice ? tag("g:sale_price", `${price.toFixed(2)} INR`) : "") +
        tag("g:brand", product.brand) +
        tag("g:gtin", attributes.gtin) +
        tag("g:mpn", attributes.mpn || product.sku) +
        tag("g:identifier_exists", hasIdentifier ? "yes" : "no") +
        tag("g:product_type", product.category) +
        tag("g:shipping_weight", attributes.weightKg ? `${attributes.weightKg} kg` : null) +
        (attributes.freeDelivery || product.free_delivery
          ? `      <g:shipping>\n        <g:country>IN</g:country>\n        <g:price>0.00 INR</g:price>\n      </g:shipping>\n`
          : "") +
        tag("g:tax_category", attributes.hsnCode) +
        tag("g:product_detail", attributes.warrantyText ? `Warranty:${attributes.warrantyText}` : null) +
        `    </item>`
      )
    })
    .filter(Boolean)
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Sara Electronics — Product Feed</title>
    <link>${origin}</link>
    <description>Google Merchant Center product feed for Sara Electronics.</description>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
