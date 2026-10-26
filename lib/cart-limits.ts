import { MAX_PURCHASE_QUANTITY } from "@/lib/purchase-validation"

export const MAX_CART_PRODUCTS = 20
export const MAX_CART_VALUE = 10_00_000

export type CartLimitItem = { id: string; price: number; quantity: number }

export function cartLimitError(items: CartLimitItem[]): string | null {
  if (items.length > MAX_CART_PRODUCTS || new Set(items.map((item) => item.id)).size > MAX_CART_PRODUCTS) {
    return "You can add up to 20 products or purchase options to your cart. Remove an item before adding another."
  }
  let value = 0
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return "Please enter a valid whole-number quantity."
    if (item.quantity > MAX_PURCHASE_QUANTITY) return `You can purchase up to ${MAX_PURCHASE_QUANTITY} units of one product.`
    if (!Number.isFinite(item.price) || item.price < 0) return "A product price is unavailable. Please refresh your cart."
    value += item.price * item.quantity
  }
  if (!Number.isFinite(value) || value > MAX_CART_VALUE) {
    return "Your product value is more than ₹10 lakh. Reduce the quantity or remove products to continue."
  }
  return null
}
