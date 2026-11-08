import type { MerchantEnrichment } from "./merchant-enrichment"

export const MERCHANT_SCRAPER_COLUMNS = ["itemno", "product link", "title", "brand", "description", "image url",
  "price", "stock", "offerid", "gtin", "manufacturer mpn", "verified manufacturer/supplier source", "Sara product link",
  "currency", "condition", "availability", "additional image urls", "source price", "source currency", "source availability",
  "model reference", "fetched at", "verification status", "issues"]
export function merchantSheetRow(enrichment: MerchantEnrichment, sara?: Record<string, unknown>): unknown[] {
  return [enrichment.itemno, enrichment.sourceUrl, enrichment.title, enrichment.brand, enrichment.description, enrichment.imageUrl,
    sara?.price ?? "", sara?.stock ?? "", sara?.offerId || enrichment.offerId, enrichment.gtin || "", enrichment.mpn || "", "",
    sara?.link || "", "INR", sara?.condition || enrichment.condition || "", sara?.availability || "", enrichment.images.slice(1).join("\n"),
    enrichment.sourcePrice ?? "", enrichment.sourceCurrency || "", enrichment.sourceAvailability || "", enrichment.model || "",
    enrichment.fetchedAt, enrichment.verificationStatus, enrichment.issues.join("; ")]
}
export function merchantSheetCsv(rows: unknown[][]): string {
  const cell = (value: unknown) => {
    const text = String(value ?? "")
    return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`
  }
  return "\ufeff" + [MERCHANT_SCRAPER_COLUMNS, ...rows].map(row => row.map(cell).join(",")).join("\r\n")
}
