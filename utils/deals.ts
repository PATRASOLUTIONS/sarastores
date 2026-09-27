/** Shared "Deal of the Day" selection logic, used by the homepage section and the promo popup. */

/** Resolve an effective MRP from the several shapes present in the product data. */
export function getEffectiveMRP(product: any): number {
  if (typeof product?.mrp === "number" && product.mrp > 0) return Math.round(product.mrp)
  try {
    const rawAny = product?.raw
    for (const cand of [rawAny?.MRP, rawAny?.mrp]) {
      if (cand === undefined || cand === null) continue
      const num = Number(String(cand).replace(/[^0-9.\-]/g, ""))
      if (!Number.isNaN(num) && num > 0) return Math.round(num)
    }
  } catch {
    /* ignore */
  }
  if (typeof product?.originalPrice === "number" && product.originalPrice > 0) return product.originalPrice
  return Math.floor((product?.price || 0) * 1.2)
}

export function discountPct(product: any): number {
  const mrp = getEffectiveMRP(product)
  const price = Number(product?.price) || 0
  if (!mrp || mrp <= price) return 0
  return Math.round(((mrp - price) / mrp) * 100)
}

export const MIN_DEAL_DISCOUNT = 10
/** Above this, the MRP is almost certainly a data-entry error (e.g. a stray zero),
 *  and advertising it would look fraudulent. */
export const MAX_DEAL_DISCOUNT = 85

/** In-stock products with a meaningful, plausible discount, best offer first. */
export function selectDeals(products: any[], limit = 12) {
  if (!Array.isArray(products)) return []
  return [...products]
    .filter((p) => {
      const pct = discountPct(p)
      return (
        pct >= MIN_DEAL_DISCOUNT &&
        pct <= MAX_DEAL_DISCOUNT &&
        (typeof p?.stock === "number" ? p.stock > 0 : true)
      )
    })
    .sort((a, b) => discountPct(b) - discountPct(a))
    .slice(0, limit)
}

/** Time remaining until the offer resets at midnight. */
export function getTimeLeft() {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const diff = Math.max(0, end.getTime() - now.getTime())
  return {
    hours: Math.floor(diff / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  }
}

export const DEALS_ANCHOR_ID = "deals-of-the-day"
