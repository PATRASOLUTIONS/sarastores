import { connectToDatabase } from "@/lib/mongodb"
import { publicCatalogueFilter } from "@/lib/public-catalogue"
import { getProductCommerceAttributes } from "@/lib/product-attributes"
import type { ProductFeedDocument } from "@/lib/seo-product"
import { merchantOfferId, merchantPreviewItem } from "@/lib/google-merchant-products"
import { getConfiguredSiteOrigin } from "@/lib/site-origin"

/**
 * Google Merchant Center product feed (RSS 2.0 + the `g:` namespace).
 *
 * Generating the feed is local; submitting it requires a Merchant Center
 * account and domain verification — see docs/brd/PENDING-EXTERNAL-INTEGRATIONS.md
 * (EXT-01). Only validated products are exported. Missing identifiers are
 * never asserted nonexistent, and internal SKUs are never exported as MPNs.
 */

export const revalidate = 300

// Merchant Center rejects feeds over 150k items; well above the current catalogue.
const MAX_ITEMS = 20000

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  return `      <${name}>${escapeXml(String(value))}</${name}>\n`
}

export async function GET() {
  const origin = getConfiguredSiteOrigin()
  if (!origin?.startsWith("https://")) return new Response("Configure the public HTTPS site origin before using this feed", { status: 503, headers: { "Cache-Control": "no-store" } })
  let products: ProductFeedDocument[] = []

  try {
    const { db } = await connectToDatabase()
    products = await db
      .collection<ProductFeedDocument>("products")
      .find(
        await publicCatalogueFilter(),
        {
          projection: {
            name: 1,
            active: 1, disabled: 1, enabled: 1, isActive: 1, deleted: 1, isDeleted: 1, deletedAt: 1, discontinued: 1, status: 1, inStock: 1,
            quantity: 1, condition: 1, identifierExists: 1, originalPrice: 1,
            slug: 1,
            description: 1,
            price: 1,
            mrp: 1,
            image: 1,
            images: 1,
            brand: 1,
            taxonomySource: 1,
            division: 1,
            manufacturerName: 1,
            manufacturer_name: 1,
            manufacturer: 1,
            raw: 1, rawData: 1, source: 1,
            category: 1,
            stock: 1,
            sku: 1,
            gtin: 1,
            GTIN: 1, ean: 1, EAN: 1, upc: 1, UPC: 1, barcode: 1, "EAN Number": 1,
            mpn: 1,
            MPN: 1, partNumber: 1, part_number: 1, "Manufacturer Part Number": 1,
            modelNumber: 1,
            weightKg: 1,
            warranty: 1,
            gstRate: 1,
            hsnCode: 1,
            seoTitle: 1,
            seoDescription: 1,
            seo_description: 1, metaDescription: 1, meta_description: 1,
            free_delivery: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .limit(MAX_ITEMS + 1)
      .toArray()
    if (products.length > MAX_ITEMS) throw new Error("Catalogue exceeds the verified export limit")
  } catch (error) {
    console.error("[Merchant feed] Product catalogue unavailable", { type: error instanceof Error ? error.name : "Error" })
    return new Response("Product feed is temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } })
  }

  const offerCounts = new Map<string, number>()
  for (const product of products) {
    const offerId = merchantOfferId(product)
    offerCounts.set(offerId, (offerCounts.get(offerId) || 0) + 1)
  }
  const items = products
    .map((product) => {
      const preview = merchantPreviewItem(product, origin, "IN", true)
      if (!preview.input || (offerCounts.get(preview.offerId) || 0) > 1) return null
      const fields = preview.input.productAttributes
      const price = preview.price

      const imageUrl = fields.imageLink

      const attributes = getProductCommerceAttributes(product)
      const title = fields.title
      const description = fields.description

      const additionalImages = fields.additionalImageLinks

      const brand = fields.brand

      return (
        `    <item>\n` +
        tag("g:id", preview.offerId) +
        tag("g:title", title.slice(0, 150)) +
        tag("g:description", description) +
        tag("g:link", fields.link) +
        tag("g:image_link", imageUrl) +
        additionalImages.map((image: string) => tag("g:additional_image_link", image)).join("") +
        tag("g:availability", fields.availability === "IN_STOCK" ? "in_stock" : "out_of_stock") +
        tag("g:condition", "new") +
        // Match the actual selling price used by the page, checkout and API.
        tag("g:price", `${price.toFixed(2)} INR`) +
        tag("g:brand", brand) +
        tag("g:gtin", fields.gtins?.[0]) +
        tag("g:mpn", fields.mpn) +
        tag("g:identifier_exists", fields.identifierExists ? "yes" : "no") +
        tag("g:product_type", product.category) +
        tag("g:shipping_weight", attributes.weightKg ? `${attributes.weightKg} kg` : null) +
        // Shipping/returns come from the reviewed Merchant account settings.
        (attributes.warrantyText ? `      <g:product_detail>\n${tag("g:section_name", "Warranty")}${tag("g:attribute_name", "Manufacturer warranty")}${tag("g:attribute_value", attributes.warrantyText)}      </g:product_detail>\n` : "") +
        `    </item>`
      )
    })
    .filter(Boolean)
    .join("\n")

  // An empty successful feed can delete an existing catalogue at Google.
  if (!items) return new Response("No verified Merchant-ready products are available. Review catalogue identifiers and product facts before submitting.", { status: 503, headers: { "Cache-Control": "no-store" } })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Sara Electronics — Product Feed</title>
  <link>${escapeXml(origin)}</link>
    <description>Google Merchant Center product feed for Sara Electronics.</description>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  })
}
