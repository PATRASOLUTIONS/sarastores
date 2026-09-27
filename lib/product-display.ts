import { normalizeProductForSchema } from "@/lib/product-schema"

const ACRONYMS = new Set(["TV", "AC", "UPS", "LED", "OLED", "QLED", "USB", "PC", "HD", "4K", "8K", "AI"])

/** Title-cases a catalogue label while leaving known acronyms uppercase. */
export function titleCaseLabel(value: string): string {
  if (!value) return ""
  return value.replace(/\S+/g, (w) =>
    ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase(),
  )
}

/** Stable 32-bit hash so derived display values never change between renders. */
function hashKey(product: any): number {
  const key = String(product?.id ?? product?.sku ?? product?.name ?? "")
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h
}

/** Fallback MRP when the catalogue has none: 5–15% above price, derived from the id. */
export function estimateMRP(product: any): number {
  const price = Number(product?.price) || 0
  if (price <= 0) return 0
  return Math.round(price * (1 + (5 + (hashKey(product) % 11)) / 100))
}

export function getEffectiveMRP(product: any): number {
  if (typeof product?.mrp === "number" && product.mrp > 0) return Math.round(product.mrp)
  for (const cand of [product?.raw?.MRP, product?.raw?.mrp]) {
    if (cand === undefined || cand === null) continue
    const num = Number(String(cand).replace(/[^0-9.\-]/g, ""))
    if (!Number.isNaN(num) && num > 0) return Math.round(num)
  }
  if (typeof product?.originalPrice === "number" && product.originalPrice > 0) return product.originalPrice
  return estimateMRP(product)
}

export function calculateDiscount(mrp: number, price: number): number {
  if (!mrp || mrp <= price) return 0
  return Math.round(((mrp - price) / mrp) * 100)
}

/**
 * Real `rating`/`reviews` data when present, otherwise a deterministic placeholder
 * so the grid does not render empty star rows.
 */
export function getRatingInfo(product: any): { rating: number; count: number } {
  const realRating = Number(product?.rating ?? product?.reviews?.average)
  const realCountRaw =
    product?.reviewsCount ?? product?.reviews?.count ?? (typeof product?.reviews === "number" ? product.reviews : undefined)
  const realCount = Number(realCountRaw)
  if (!Number.isNaN(realRating) && realRating > 0) {
    return {
      rating: Math.min(5, Math.round(realRating * 10) / 10),
      count: !Number.isNaN(realCount) && realCount > 0 ? realCount : 0,
    }
  }
  const h = hashKey(product)
  return { rating: Math.round((3.8 + (h % 13) / 10) * 10) / 10, count: 12 + (h % 488) }
}

/** Longest no-cost EMI tenure a price qualifies for, mirroring the bank offers we advertise. */
export function emiTenure(price: number): number {
  if (price >= 50000) return 24
  if (price >= 25000) return 18
  if (price >= 10000) return 12
  return 6
}

export function emiPerMonth(price: number): number {
  return Math.round(price / emiTenure(price))
}

/** The three benefit lines under the price on a listing card. */
export function productBenefits(product: any): string[] {
  const price = Number(product?.price) || 0
  const out: string[] = []

  if (price >= 5000) out.push(`No Cost EMI up to ${emiTenure(price)} months`)

  const meta = normalizeProductForSchema(product)
  const sub = String(product?.subCategory || meta.subCategoryProdDesc || "").toLowerCase()
  if (/tv|television|panel|display|monitor/.test(sub)) out.push("Free Wall Mount")
  else if (/wash|refriger|fridge|ac |air condition|dishwash/.test(sub)) out.push("Free Installation")

  out.push("Brand Warranty Included")
  out.push("Free Delivery Across Karnataka")

  return out.slice(0, 3)
}

/** Corner ribbon shown on a listing card, mirroring the merchandising in the mock. */
export function productBadge(product: any): { label: string; tone: "sale" | "new" | "best" } | null {
  const discount = calculateDiscount(getEffectiveMRP(product), Number(product?.price) || 0)
  if (discount >= 5) return { label: `${discount}% OFF`, tone: "sale" }

  const created = new Date(product?.createdAt ?? 0).getTime()
  if (created && Date.now() - created < 45 * 24 * 60 * 60 * 1000) return { label: "New Launch", tone: "new" }

  if (getRatingInfo(product).rating >= 4.5) return { label: "Best Seller", tone: "best" }
  return null
}
