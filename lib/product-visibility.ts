import { purchaseAvailabilityError } from "@/lib/purchase-validation"

/**
 * The single public-catalogue visibility rule.
 *
 * Product imports and creation routes persist an explicit boolean, so only
 * `active: true` is storefront-visible. Missing, malformed, and false values
 * fail closed. Admin and vendor management routes deliberately do not use this
 * filter because staff must be able to find and reactivate products.
 */
export const PUBLIC_PRODUCT_FILTER = Object.freeze({
  active: true,
  disabled: { $ne: true }, enabled: { $ne: false }, isActive: { $ne: false },
  deleted: { $ne: true }, isDeleted: { $ne: true }, deletedAt: null,
  discontinued: { $ne: true },
  status: { $nin: ["inactive", "draft", "archived", "deleted", "discontinued", "disabled", "out-of-stock", "out_of_stock"] },
} as const)

export function isPublicProduct<T>(product: T): product is T & { active: true } {
  return typeof product === "object" && product !== null && "active" in product
    && product.active === true && !purchaseAvailabilityError(product)
}
