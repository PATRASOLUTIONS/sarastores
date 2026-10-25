export const MAX_PURCHASE_QUANTITY = 1000

export type PurchaseProduct = {
  active?: unknown; isActive?: unknown; enabled?: unknown; disabled?: unknown;
  deleted?: unknown; isDeleted?: unknown; deletedAt?: unknown; discontinued?: unknown;
  status?: unknown; stock?: unknown; quantity?: unknown; totalKeysAvailable?: unknown;
  trackInventory?: unknown; maxPurchaseQuantity?: unknown;
}

export function purchaseAvailabilityError(product: PurchaseProduct, software = false): string | null {
  if (product.deleted === true || product.isDeleted === true || product.deletedAt
    || product.discontinued === true || product.disabled === true || product.enabled === false
    || product.isActive === false || product.active === false) return "This product is no longer available."
  const status = typeof product.status === "string" ? product.status.trim().toLowerCase() : ""
  if (["inactive", "draft", "archived", "deleted", "discontinued", "disabled", "out-of-stock", "out_of_stock"].includes(status)) {
    return "This product is no longer available."
  }
  if (software ? product.active !== true && status !== "active" : product.active !== true) {
    return "This product is not active."
  }
  return null
}

export function purchaseStock(product: PurchaseProduct, software = false): number | null {
  // Only an explicit non-inventory software product is unlimited.
  if (software && product.trackInventory === false) return null
  const value = product.stock ?? (software ? product.totalKeysAvailable : undefined) ?? product.quantity
  if ((typeof value !== "number" && typeof value !== "string") || value === "" ||
    !Number.isSafeInteger(Number(value)) || Number(value) < 0) return 0
  return Number(value)
}

export function purchaseLimit(product: PurchaseProduct): number {
  if (product.maxPurchaseQuantity == null) return MAX_PURCHASE_QUANTITY
  const limit = Number(product.maxPurchaseQuantity)
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, MAX_PURCHASE_QUANTITY) : 0
}
