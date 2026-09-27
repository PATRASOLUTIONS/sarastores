/**
 * Canonical shape of a `product_specifications` document.
 *
 * Three writers used to build this document by hand — the Amazon scraper, the
 * bulk upload route and the admin spec editor — and each produced a slightly
 * different shape. `reviews` was an object on one path and an array on another,
 * `product_id` was sometimes an ObjectId and sometimes a string, and `updatedAt`
 * was sometimes a Date and sometimes an ISO string. The product page only
 * renders one of those variants, so specs written by the wrong path rendered
 * blank tabs.
 *
 * Everything now goes through `buildSpecificationDocument`, so the collection
 * holds one shape regardless of where a record came from.
 */

export const SPECIFICATIONS_COLLECTION = "product_specifications"

export interface SpecificationReview {
  rating: number | null
  title: string
  text: string
}

export interface ProductSpecification {
  /** Join key to `products.sku`. Required — a spec without one is unreachable. */
  sku: string
  /** Always a string; the product page builds URLs from it. */
  product_id: string | null
  name: string
  category: string
  subCategory: string
  prod_desc: string
  group_name: string
  char_desc: string
  manufacturer_name: string
  mrp: number | null
  overview: string
  from_manufacturer: string
  technical_details: Record<string, string>
  specification_images: string[]
  included_components: string[]
  features: string[]
  reviews: SpecificationReview[]
  locked: boolean
  isSynced: boolean
  updatedAt: Date
}

/** Fields the PATCH endpoint is allowed to write. */
export const EDITABLE_SPECIFICATION_FIELDS = [
  "name",
  "category",
  "subCategory",
  "prod_desc",
  "group_name",
  "char_desc",
  "manufacturer_name",
  "mrp",
  "overview",
  "description",
  "from_manufacturer",
  "technical_details",
  "specification_images",
  "included_components",
  "features",
  "reviews",
  "product_id",
  "locked",
  "isSynced",
] as const

const text = (value: unknown): string => {
  if (value == null) return ""
  const s = String(value).trim()
  // Spreadsheet imports use "NA" as a placeholder; treat it as absent.
  return /^["']?na["']?$/i.test(s) ? "" : s
}

const isHttpUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim())

/** Accepts an array, a comma-separated string, or a single value. */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => text(v)).filter(Boolean)
  }
  const s = text(value)
  if (!s) return []
  return s
    .split(/\s*[,\n]\s*/)
    .map((v) => v.trim())
    .filter(Boolean)
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.]/g, ""))
  return Number.isFinite(n) ? n : null
}

function toRecord(value: unknown): Record<string, string> {
  let source: any = value
  if (typeof source === "string") {
    try {
      source = JSON.parse(source)
    } catch {
      return {}
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return {}

  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(source)) {
    const key = String(k).trim()
    const val = text(v)
    if (key && val) out[key] = val
  }
  return out
}

/**
 * Normalises every review shape the scraper and the admin UI produce into a
 * plain array. The Amazon scraper returns a summary object whose reviews live
 * under `customerReviews` / `topReviews`; the product page only accepts an array.
 */
export function normalizeReviews(value: unknown): SpecificationReview[] {
  const raw: any[] = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? ((value as any).customerReviews ?? (value as any).topReviews ?? (value as any).top ?? [])
      : []

  if (!Array.isArray(raw)) return []

  return raw
    .map((r) => {
      if (typeof r === "string") return { rating: null, title: "", text: text(r) }
      return {
        rating: toNumber(r?.rating),
        title: text(r?.title),
        text: text(r?.text ?? r?.body ?? r?.content),
      }
    })
    .filter((r) => r.text || r.title)
}

export interface SpecificationInput {
  sku: unknown
  product_id?: unknown
  name?: unknown
  category?: unknown
  subCategory?: unknown
  prod_desc?: unknown
  group_name?: unknown
  char_desc?: unknown
  manufacturer_name?: unknown
  mrp?: unknown
  overview?: unknown
  description?: unknown
  from_manufacturer?: unknown
  technical_details?: unknown
  specification_images?: unknown
  /** Product gallery images, kept ahead of A+ marketing art in the final list. */
  gallery_images?: unknown
  included_components?: unknown
  features?: unknown
  reviews?: unknown
  locked?: unknown
  isSynced?: unknown
}

/**
 * Builds a specification document in the canonical shape. Returns `null` when
 * there is no SKU, because the whole pipeline joins on it.
 */
export function buildSpecificationDocument(input: SpecificationInput): ProductSpecification | null {
  const sku = text(input.sku)
  if (!sku) return null

  const features = toStringArray(input.features)
  const overview = text(input.overview) || text(input.description)

  // Gallery photos first, then A+ marketing images, de-duplicated. Syncing a
  // spec back to a product copies the first few of these into the product
  // gallery, so lifestyle banners must not crowd out the real product photos.
  const images = Array.from(
    new Set([...toStringArray(input.gallery_images), ...toStringArray(input.specification_images)]),
  ).filter(isHttpUrl)

  return {
    sku,
    product_id: text(input.product_id) || null,
    name: text(input.name),
    category: text(input.category),
    subCategory: text(input.subCategory),
    prod_desc: text(input.prod_desc),
    group_name: text(input.group_name),
    char_desc: text(input.char_desc),
    manufacturer_name: text(input.manufacturer_name),
    mrp: toNumber(input.mrp),
    // The product page shows features when present, so a duplicate overview is noise.
    overview: features.length > 0 ? "" : overview,
    from_manufacturer: text(input.from_manufacturer),
    technical_details: toRecord(input.technical_details),
    specification_images: images,
    included_components: toStringArray(input.included_components),
    features,
    reviews: normalizeReviews(input.reviews),
    locked: input.locked === true,
    isSynced: input.isSynced === true,
    updatedAt: new Date(),
  }
}

/**
 * Same as `buildSpecificationDocument` but drops empty values, for `$set` on an
 * existing record where a blank field should not overwrite good data.
 */
export function buildSpecificationPatch(
  input: SpecificationInput,
): Partial<ProductSpecification> | null {
  const full = buildSpecificationDocument(input)
  if (!full) return null

  const patch: Record<string, unknown> = { sku: full.sku, updatedAt: full.updatedAt }
  for (const [key, value] of Object.entries(full)) {
    if (key === "sku" || key === "updatedAt") continue
    if (value == null) continue
    if (typeof value === "string" && value === "") continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue
    patch[key] = value
  }
  return patch as Partial<ProductSpecification>
}
