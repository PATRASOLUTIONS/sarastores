/**
 * Common contract for every product-source scraper.
 *
 * Two groups of fields, deliberately separated:
 *
 *  - `SAP_OWNED_FIELDS` are the master-data fields that SAP will own once the
 *    integration lands. Scrapers only ever *suggest* them, so a data-entry
 *    operator can accept a suggestion today and SAP can overwrite it later
 *    without touching anything else.
 *  - Everything else is enrichment (specs, imagery, marketing copy) that SAP
 *    does not carry and the scraper is authoritative for.
 */

export type ScraperSource =
  | "amazon"
  | "flipkart"
  | "pai"
  | "lg"
  | "reliance"
  | "vijaysales"
  | "bosch"
  | "pdf"

export const SCRAPER_LABELS: Record<ScraperSource, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  pai: "Pai International",
  lg: "LG India",
  reliance: "Reliance Digital",
  vijaysales: "Vijay Sales",
  bosch: "Bosch Home",
  pdf: "Vendor PDF",
}

/** Master data SAP becomes the system of record for. */
export const SAP_OWNED_FIELDS = [
  "sku",
  "name",
  "category",
  "subCategory",
  "brand",
  "charDesc",
  "price",
] as const

export type SapOwnedField = (typeof SAP_OWNED_FIELDS)[number]

/** What a scraper suggests for the SAP-owned fields. All optional. */
export interface SapFieldSuggestions {
  sku: string
  name: string
  category: string
  subCategory: string
  brand: string
  charDesc: string
  price: number | null
}

export interface ScrapedProduct {
  source: ScraperSource
  sourceUrl: string
  /** ASIN, FSN, site SKU or model code — whatever identifies it upstream. */
  externalId: string | null

  /** Suggestions for SAP-owned master data. */
  sap: SapFieldSuggestions

  /** Enrichment the scraper owns. */
  mrp: number | null
  description: string
  images: string[]
  features: string[]
  technicalDetails: Record<string, string>
  manufacturerInfo: string
  manufacturerImages: string[]
  whatsIncluded: string[]
  warranty: string
  rating: number | null
  reviewCount: number | null
  inStock: boolean
  reviews: { rating: number | null; title: string; text: string }[]
}

export class ScraperError extends Error {
  constructor(
    message: string,
    readonly status: number = 422,
    /** Shown to the operator as the next thing to try. */
    readonly hint?: string,
  ) {
    super(message)
    this.name = "ScraperError"
  }
}

export function emptyProduct(source: ScraperSource, sourceUrl: string): ScrapedProduct {
  return {
    source,
    sourceUrl,
    externalId: null,
    sap: { sku: "", name: "", category: "", subCategory: "", brand: "", charDesc: "", price: null },
    mrp: null,
    description: "",
    images: [],
    features: [],
    technicalDetails: {},
    manufacturerInfo: "",
    manufacturerImages: [],
    whatsIncluded: [],
    warranty: "",
    rating: null,
    reviewCount: null,
    inStock: true,
    reviews: [],
  }
}
