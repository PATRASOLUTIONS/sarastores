import { z } from "zod"
import { readCheckoutDraft } from "@/lib/checkout-draft"

export const CartCouponSelectionSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string(),
  couponRemovable: z.boolean().default(true),
})
export type CartCouponSelection = z.infer<typeof CartCouponSelectionSchema>
const key = (owner: string) => `sara_cart_coupon:${owner}`
export const CART_COUPON_UPDATED = "cart-coupon-updated"

export function readCartCoupon(owner: string): CartCouponSelection | null {
  const stored = localStorage.getItem(key(owner))
  // An explicit null records removal; it must not restore an older draft.
  if (stored !== null) return CartCouponSelectionSchema.nullable().parse(JSON.parse(stored))
  const saved = readCheckoutDraft(owner)?.appliedCoupon
  return saved ? CartCouponSelectionSchema.parse(saved) : null
}

export function saveCartCoupon(owner: string, coupon: CartCouponSelection | null) {
  localStorage.setItem(key(owner), JSON.stringify(coupon === null ? null : CartCouponSelectionSchema.parse(coupon)))
  window.dispatchEvent(new Event(CART_COUPON_UPDATED))
}

export function clearCartCoupon(owner: string) {
  try { saveCartCoupon(owner, null) } catch { /* Completed orders still clear their checkout draft. */ }
}
