/**
 * Server-side product display fields.
 *
 * MRP fallbacks, discount percentages, ratings, EMI figures and badges were
 * being derived in React on the web. A native app cannot run React, so
 * re-deriving them on the client would eventually show different prices and
 * EMI figures than the website for the same product — a support problem, and a
 * compliance one where discount and EMI claims are advertised.
 *
 * Computing them once here makes the API the single source of truth. The helper
 * modules are already pure TypeScript, so this composes them rather than
 * reimplementing anything.
 */

import {
  calculateDiscount,
  emiPerMonth,
  emiTenure,
  getEffectiveMRP,
  getRatingInfo,
  productBadge,
  productBenefits,
} from "@/lib/product-display"
import { getLowestEmiPlan, isEmiAvailable } from "@/lib/emi"

export interface ProductDisplay {
  mrp: number
  price: number
  discountPercent: number
  rating: number
  reviewCount: number
  inStock: boolean
  badge: { label: string; tone: "sale" | "new" | "best" } | null
  benefits: string[]
  emi: {
    available: boolean
    tenureMonths: number
    perMonth: number
    lowestPerMonth: number | null
    lowestIssuer: string | null
  }
}

export function buildProductDisplay(product: any): ProductDisplay {
  const price = Number(product?.price) || 0
  const mrp = getEffectiveMRP(product)
  const rating = getRatingInfo(product)
  const emiAvailable = isEmiAvailable(price)
  const lowest = emiAvailable ? getLowestEmiPlan(price) : null

  return {
    mrp,
    price,
    discountPercent: calculateDiscount(mrp, price),
    rating: rating.rating,
    reviewCount: rating.count,
    inStock: typeof product?.stock === "number" ? product.stock > 0 : true,
    badge: productBadge(product),
    benefits: productBenefits(product),
    emi: {
      available: emiAvailable,
      tenureMonths: emiTenure(price),
      perMonth: emiPerMonth(price),
      lowestPerMonth: lowest ? lowest.monthlyAmount : null,
      lowestIssuer: lowest ? lowest.issuerName : null,
    },
  }
}

/** Attach `display` to a product without mutating the source document. */
export function withProductDisplay<T extends Record<string, any>>(product: T): T & { display: ProductDisplay } {
  return { ...product, display: buildProductDisplay(product) }
}
