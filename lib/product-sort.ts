/**
 * Product list sorting, shared by the category and products listing pages.
 *
 * The BRD requires Relevance / Price low→high / Price high→low / Newest /
 * Discount on every listing ("CATEGORY PAGE — REBUILD COMPLETELY").
 */

export type ProductSortKey = "relevance" | "price-asc" | "price-desc" | "newest" | "discount" | "rating"

export const PRODUCT_SORT_OPTIONS: { value: ProductSortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "discount", label: "Discount" },
  { value: "newest", label: "Newest First" },
  { value: "rating", label: "Customer Rating" },
]

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getMrp(product: any): number {
  const raw = product?.raw ?? {}
  return toNumber(
    product?.mrp ?? product?.originalPrice ?? raw?.MRP ?? raw?.mrp ?? raw?.["M.R.P"],
  )
}

/** Discount percentage off MRP; 0 when there is no usable MRP. */
export function getDiscountPercent(product: any): number {
  const price = toNumber(product?.price)
  const mrp = getMrp(product)
  if (!mrp || !price || mrp <= price) return 0
  return ((mrp - price) / mrp) * 100
}

function getTimestamp(product: any): number {
  const value = product?.createdAt ?? product?.updatedAt
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function getRating(product: any): number {
  if (typeof product?.rating === "number") return product.rating
  const reviews = product?.reviews
  if (reviews && !Array.isArray(reviews) && typeof reviews.average === "number") return reviews.average
  return 0
}

/** Returns a new array; the input is never mutated. */
export function sortProducts<T>(products: T[], sortBy: ProductSortKey): T[] {
  if (sortBy === "relevance") return products

  const sorted = [...products]

  switch (sortBy) {
    case "price-asc":
      return sorted.sort((a, b) => toNumber((a as any).price) - toNumber((b as any).price))
    case "price-desc":
      return sorted.sort((a, b) => toNumber((b as any).price) - toNumber((a as any).price))
    case "discount":
      return sorted.sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a))
    case "newest":
      return sorted.sort((a, b) => getTimestamp(b) - getTimestamp(a))
    case "rating":
      return sorted.sort((a, b) => getRating(b) - getRating(a))
    default:
      return sorted
  }
}

export function isProductSortKey(value: string | null | undefined): value is ProductSortKey {
  return PRODUCT_SORT_OPTIONS.some((option) => option.value === value)
}
