import { purchaseAvailabilityError, purchaseStock, type PurchaseProduct } from "@/lib/purchase-validation"

/** Display availability for catalogue cards, including older records without stock. */
export function isProductUnavailable(product: PurchaseProduct & { price?: unknown; inStock?: unknown }): boolean {
  return Boolean(purchaseAvailabilityError({ ...product, active: product.active ?? true }))
    || product.inStock === false
    || (product.stock != null && purchaseStock(product) === 0)
    || !Number.isFinite(Number(product.price)) || Number(product.price) <= 0
}
