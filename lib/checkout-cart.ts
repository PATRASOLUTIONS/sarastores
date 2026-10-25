import type { CartItem } from "@/contexts/CartContext"

export const CHECKOUT_CART_INTENT = "checkoutCartBeforeSignIn"
export const CHECKOUT_CART_SELECTION_ID = "checkoutCartSelectionId"

export function mergeCheckoutCart(current: CartItem[], previous: CartItem[]): CartItem[] {
  const merged = current.map(item => ({ ...item }))
  for (const item of previous) {
    const index = merged.findIndex(existing => existing.id === item.id)
    if (index < 0) merged.push({ ...item })
    else merged[index].quantity += Number(item.quantity)
  }
  return merged
}
