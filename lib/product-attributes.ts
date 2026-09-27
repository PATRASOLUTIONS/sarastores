/**
 * Commerce attributes required by the BRD ("PRODUCT DATA — AGENCY MUST FIX THIS").
 *
 * Product documents in Mongo are heterogeneous — they come from Excel imports,
 * the Amazon scraper and the admin editor, so the same value can live under
 * several keys. This module is the single place that reads those attributes and
 * normalises them, so feeds, schema.org output and the product page all agree.
 *
 * Nothing here writes. Adding a field is safe: every reader tolerates absence.
 */

export interface ProductDimensionsCm {
  length?: number
  width?: number
  height?: number
}

export interface StoreStockEntry {
  storeId: string
  storeName?: string
  quantity: number
}

export interface ProductCommerceAttributes {
  /** Global Trade Item Number (EAN/UPC). Required by Google Merchant Center. */
  gtin: string | null
  /** Manufacturer Part Number. Substitutes for GTIN when unavailable. */
  mpn: string | null
  modelNumber: string | null
  /** Indian HSN classification code, sourced from SAP once SAP-01 lands. */
  hsnCode: string | null
  /** Per-product GST percentage. Falls back to the platform default. */
  gstRate: number
  warrantyMonths: number | null
  warrantyText: string | null
  weightKg: number | null
  dimensionsCm: ProductDimensionsCm | null
  /** Per-store availability. Empty until the SAP inventory feed is connected. */
  storeStock: StoreStockEntry[]
  emiAvailable: boolean
  codAvailable: boolean
  freeDelivery: boolean
  installationAvailable: boolean
  seoTitle: string | null
  seoDescription: string | null
  /** Promotional price window, honoured by the pricing engine when present. */
  priceValidFrom: Date | null
  priceValidTo: Date | null
}

/** Platform-wide GST fallback used when a product has no explicit rate. */
export const DEFAULT_GST_RATE = 18

function raw(product: any): Record<string, any> {
  const nested = product?.raw ?? product?.rawData ?? product?.source
  return nested && typeof nested === "object" ? nested : {}
}

function firstString(product: any, keys: string[]): string | null {
  const source = raw(product)
  for (const key of keys) {
    const value = product?.[key] ?? source?.[key]
    if (value === null || value === undefined) continue
    const normalized = String(value).trim()
    if (normalized) return normalized
  }
  return null
}

function firstNumber(product: any, keys: string[]): number | null {
  const source = raw(product)
  for (const key of keys) {
    const value = product?.[key] ?? source?.[key]
    if (value === null || value === undefined || value === "") continue
    // Strip units and separators: "12.5 kg", "1,299" → 12.5, 1299
    const parsed = Number(String(value).replace(/[^0-9.\-]/g, ""))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function firstBoolean(product: any, keys: string[]): boolean | null {
  const source = raw(product)
  for (const key of keys) {
    const value = product?.[key] ?? source?.[key]
    if (value === null || value === undefined || value === "") continue
    if (typeof value === "boolean") return value
    const normalized = String(value).trim().toLowerCase()
    if (["true", "yes", "y", "1", "available"].includes(normalized)) return true
    if (["false", "no", "n", "0", "unavailable"].includes(normalized)) return false
  }
  return null
}

function firstDate(product: any, keys: string[]): Date | null {
  const source = raw(product)
  for (const key of keys) {
    const value = product?.[key] ?? source?.[key]
    if (!value) continue
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return null
}

/** "2 years", "24 months", "1 yr" → months. */
export function parseWarrantyMonths(text: string | null | undefined): number | null {
  if (!text) return null
  const value = String(text).toLowerCase()

  const years = value.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y\b)/)
  if (years) return Math.round(parseFloat(years[1]) * 12)

  const months = value.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?|m\b)/)
  if (months) return Math.round(parseFloat(months[1]))

  return null
}

function parseDimensions(product: any): ProductDimensionsCm | null {
  const explicit = product?.dimensionsCm ?? product?.dimensions
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
    const length = Number(explicit.length ?? explicit.l)
    const width = Number(explicit.width ?? explicit.w)
    const height = Number(explicit.height ?? explicit.h)
    if ([length, width, height].some(Number.isFinite)) {
      return {
        length: Number.isFinite(length) ? length : undefined,
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
      }
    }
  }

  // Free-text forms from spec sheets: "80 x 45 x 30 cm".
  const text = firstString(product, ["dimensions", "product_dimensions", "Product Dimensions", "size"])
  if (!text) return null
  const parts = text.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i)
  if (!parts) return null

  return {
    length: parseFloat(parts[1]),
    width: parseFloat(parts[2]),
    height: parseFloat(parts[3]),
  }
}

function parseStoreStock(product: any): StoreStockEntry[] {
  const value = product?.storeStock ?? product?.store_stock
  if (!Array.isArray(value)) return []

  return value
    .map((entry: any) => ({
      storeId: String(entry?.storeId ?? entry?.store_id ?? "").trim(),
      storeName: entry?.storeName ?? entry?.store_name ?? undefined,
      quantity: Number(entry?.quantity ?? entry?.qty ?? 0) || 0,
    }))
    .filter((entry: StoreStockEntry) => entry.storeId.length > 0)
}

export function getProductCommerceAttributes(product: any): ProductCommerceAttributes {
  const warrantyText = firstString(product, [
    "warrantyText",
    "warranty",
    "Warranty",
    "warranty_description",
  ])

  const gstRate = firstNumber(product, ["gstRate", "gst_rate", "GST", "gst", "taxRate"])

  return {
    gtin: firstString(product, ["gtin", "GTIN", "ean", "EAN", "upc", "UPC", "barcode"]),
    mpn: firstString(product, ["mpn", "MPN", "partNumber", "part_number"]),
    modelNumber: firstString(product, [
      "modelNumber",
      "model_number",
      "Model Number",
      "model",
      "Model",
    ]),
    hsnCode: firstString(product, ["hsnCode", "hsn_code", "HSN", "hsn", "HSN Code"]),
    gstRate: gstRate !== null && gstRate >= 0 && gstRate <= 100 ? gstRate : DEFAULT_GST_RATE,
    warrantyMonths:
      firstNumber(product, ["warrantyMonths", "warranty_months"]) ?? parseWarrantyMonths(warrantyText),
    warrantyText,
    weightKg: firstNumber(product, ["weightKg", "weight_kg", "weight", "Weight", "item_weight"]),
    dimensionsCm: parseDimensions(product),
    storeStock: parseStoreStock(product),
    emiAvailable: firstBoolean(product, ["emiAvailable", "emi_available"]) ?? true,
    codAvailable: firstBoolean(product, ["codAvailable", "cod_available"]) ?? false,
    freeDelivery: firstBoolean(product, ["freeDelivery", "free_delivery"]) ?? false,
    installationAvailable:
      firstBoolean(product, ["installationAvailable", "installation_available"]) ?? false,
    seoTitle: firstString(product, ["seoTitle", "seo_title", "metaTitle", "meta_title"]),
    seoDescription: firstString(product, [
      "seoDescription",
      "seo_description",
      "metaDescription",
      "meta_description",
    ]),
    priceValidFrom: firstDate(product, ["priceValidFrom", "price_valid_from", "effectiveFrom"]),
    priceValidTo: firstDate(product, ["priceValidTo", "price_valid_to", "effectiveTo"]),
  }
}

/** Total sellable units across stores; `null` when no store feed exists yet. */
export function getStoreStockTotal(attributes: ProductCommerceAttributes): number | null {
  if (attributes.storeStock.length === 0) return null
  return attributes.storeStock.reduce((total, entry) => total + entry.quantity, 0)
}

export function isAvailableAtStore(attributes: ProductCommerceAttributes, storeId: string): boolean {
  return attributes.storeStock.some((entry) => entry.storeId === storeId && entry.quantity > 0)
}

/**
 * Whether a promotional price window is currently open. A product with no
 * window is always considered active.
 */
export function isPriceWindowActive(
  attributes: ProductCommerceAttributes,
  now: Date = new Date(),
): boolean {
  if (attributes.priceValidFrom && now < attributes.priceValidFrom) return false
  if (attributes.priceValidTo && now > attributes.priceValidTo) return false
  return true
}
