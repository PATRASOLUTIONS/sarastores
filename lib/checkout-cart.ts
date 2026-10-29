import type { CartItem } from "@/contexts/CartContext"
import { cartLineKey } from "@/lib/cart-line"

export const CHECKOUT_CART_INTENT = "checkoutCartBeforeSignIn"
export const CHECKOUT_CART_SELECTION_ID = "checkoutCartSelectionId"

export function mergeCheckoutCart(current: CartItem[], previous: CartItem[]): CartItem[] {
  const merged = current.map(item => ({ ...item }))
  for (const item of previous) {
    const index = merged.findIndex(existing => cartLineKey(existing) === cartLineKey(item))
    if (index < 0) merged.push({ ...item })
    else {
      merged[index].quantity += Number(item.quantity)
      if (item.saraCareSelection === null) merged[index].saraCareSelection = null
      else if (merged[index].saraCareSelection === undefined && item.saraCareSelection !== undefined) merged[index].saraCareSelection = item.saraCareSelection
    }
  }
  const covered = new Set<string>()
  return merged.flatMap(item => {
    if (!item.saraCare) return [item]
    const parentKey = item.saraCare.parentLineKey
    const parent = merged.find(candidate => !candidate.saraCare && cartLineKey(candidate) === parentKey)
    if (!parent || parent.saraCareSelection === null || covered.has(parentKey) ||
      (parent.saraCareSelection !== undefined && parent.saraCareSelection !== item.saraCare.durationYears)) return []
    covered.add(parentKey)
    return [{ ...item, quantity: parent.quantity }]
  })
}
