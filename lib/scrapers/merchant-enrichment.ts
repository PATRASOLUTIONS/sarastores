import { randomUUID } from "node:crypto"
import type { Document } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { merchantPreviewItem } from "@/lib/google-merchant-products"
import { getConfiguredSiteOrigin } from "@/lib/site-origin"
import { formatProductName } from "@/lib/product-name-format"
import { purchaseStock, purchaseAvailabilityError } from "@/lib/purchase-validation"
import { ADAPTERS } from "./adapters"
import { scrapeAmazonMerchant } from "./amazon-merchant"
import { detectSource, isShortLink, resolveRedirect } from "./http"
import { ScraperError, type ScrapedProduct } from "./types"
import { scraperItemNumberKey, type ScraperImportRow } from "./bulk-import"

export const MERCHANT_ENRICHMENT_COLLECTION = "merchant_product_enrichments"
export interface MerchantEnrichment {
  itemno: string; offerId: string; sourceUrl: string; fetchedAt: string
  title: string; brand: string; description: string; imageUrl: string; images: string[]
  gtin: string | null; mpn: string | null; model: string | null
  sourcePrice: number | null; sourceCurrency: string | null; sourceAvailability: string | null
  condition: string | null; evidence: NonNullable<ScrapedProduct["merchantFacts"]>["evidence"]
  verificationStatus: "needs_review"; issues: string[]; product: ScrapedProduct
}
interface EnrichmentRecord extends Document {
  _id: string; status: "fetching" | "complete"; enrichment?: MerchantEnrichment
}
export function curateMerchantEnrichment(enrichment: MerchantEnrichment): MerchantEnrichment {
  const images = enrichment.product?.merchantFacts?.primaryImages?.length
    ? enrichment.product.merchantFacts.primaryImages : enrichment.imageUrl ? [enrichment.imageUrl] : []
  return { ...enrichment, title: formatProductName(enrichment.title), images, imageUrl: images[0] || "" }
}
export function merchantCatalogueFacts(product: Record<string, unknown>) {
  const stock = product.stock ?? product.quantity
  const known = (typeof stock === "number" || typeof stock === "string") && String(stock).trim() !== "" && Number.isSafeInteger(Number(stock)) && Number(stock) >= 0
  const origin = getConfiguredSiteOrigin()
  return { price: Number.isFinite(Number(product.price)) && Number(product.price) > 0 ? Number(product.price) : "", stock: known ? Number(stock) : "",
    offerId: String(product.sku || product.slug || product._id || ""),
    link: origin ? `${origin}/product/${encodeURIComponent(String(product.slug || product._id || ""))}` : "",
    condition: String(product.condition || "new"), availability: known && !purchaseAvailabilityError(product)
      ? (Number(purchaseStock(product)) > 0 && product.inStock !== false ? "in_stock" : "out_of_stock") : "" }
}
export async function extractMerchantEnrichment(row: ScraperImportRow): Promise<MerchantEnrichment> {
  let url = row.url, source = detectSource(url)
  if (!source || source === "pdf") throw new ScraperError("Unsupported retailer/manufacturer product link", 400)
  if (isShortLink(url)) { url = await resolveRedirect(url); source = detectSource(url) }
  if (!source || source === "pdf") throw new ScraperError("Unsupported resolved product link", 400)
  const product = source === "amazon" ? await scrapeAmazonMerchant(url) : await ADAPTERS[source](url)
  const facts = product.merchantFacts
  if (!facts) throw new ScraperError("Source did not return identifier evidence", 422)
  return curateMerchantEnrichment({ itemno: scraperItemNumberKey(row.itemno), offerId: scraperItemNumberKey(row.itemno), sourceUrl: product.sourceUrl,
    fetchedAt: new Date().toISOString(), title: product.sap.name, brand: product.sap.brand,
    description: product.description, imageUrl: product.images[0] || "", images: product.images,
    gtin: facts.gtin, mpn: facts.mpn, model: facts.model, condition: facts.condition,
    sourcePrice: product.sap.price, sourceCurrency: facts.currency, sourceAvailability: facts.availability,
    evidence: facts.evidence, verificationStatus: "needs_review", product,
    issues: [...facts.issues, ...(!product.sap.brand ? ["Brand missing on source page."] : []),
      ...(!product.description ? ["Description missing on source page."] : []), ...(!product.images.length ? ["Product images missing on source page."] : []),
      "Verify source product matches Sara's exact model, colour and capacity before using identifiers."] })
}

/** Built-in unique _id plus renewable lease makes concurrent uploads fetch once. No catalogue writes. */
export async function storeMerchantEnrichment(row: ScraperImportRow, ownerId: string) {
  const collection = await getCollection<EnrichmentRecord>(MERCHANT_ENRICHMENT_COLLECTION)
  const key = scraperItemNumberKey(row.itemno)
  const existing = await collection.findOne({ _id: key })
  if (existing?.status === "complete") return { skipped: true, enrichment: curateMerchantEnrichment(existing.enrichment as MerchantEnrichment) }
  const leaseToken = randomUUID(), now = new Date(), leaseUntil = new Date(now.getTime() + 5 * 60 * 1000)
  if (existing) {
    const claim = await collection.findOneAndUpdate({ _id: key, status: "fetching", leaseUntil: { $lt: now } },
      { $set: { leaseToken, leaseUntil, ownerId } }, { returnDocument: "after" })
    if (!claim) throw new ScraperError("This item is already being fetched. Check again after it finishes.", 409)
  } else {
    try { await collection.insertOne({ _id: key, status: "fetching", leaseToken, leaseUntil, ownerId }) }
    catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) throw new ScraperError("This item was claimed by another upload. Check it again.", 409)
      throw error
    }
  }
  try {
    const enrichment = await extractMerchantEnrichment(row)
    const result = await collection.updateOne({ _id: key, leaseToken, status: "fetching" },
      { $set: { status: "complete", enrichment, completedAt: new Date() }, $unset: { leaseToken: "", leaseUntil: "" } })
    if (result.matchedCount !== 1) throw new ScraperError("The save lease changed. Check saved results before retrying.", 409)
    return { skipped: false, enrichment }
  } catch (error) {
    await collection.deleteOne({ _id: key, leaseToken, status: "fetching" })
    throw error
  }
}

/** Preview merges only candidate content with Sara's money/inventory; never publishes it. */
export function enrichmentMerchantPreview(enrichment: MerchantEnrichment, product: Record<string, unknown> | null) {
  if (!product) return { input: null, errors: ["No unique Sara catalogue product matches this item number."] }
  const preview = merchantPreviewItem({ ...product, name: enrichment.title, description: enrichment.description,
    seoDescription: enrichment.description, brand: enrichment.brand, taxonomySource: "metadata-sheet",
    gtin: enrichment.gtin || "", mpn: enrichment.mpn || "", image: enrichment.imageUrl, images: enrichment.images,
    ...(enrichment.condition ? { condition: enrichment.condition } : {}) }, getConfiguredSiteOrigin() || "https://www.sarastores.com", "IN")
  return { ...preview, errors: [...preview.errors, "Extracted identifiers and image usage require operator verification before catalogue update."], input: null }
}
