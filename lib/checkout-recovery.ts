import { z } from "zod"

export const PurchasedItemsSchema = z.array(z.object({
  id: z.string().optional(), productId: z.string().optional(), quantity: z.number().int().positive(),
  type: z.string().nullish(), sku: z.string().nullish(), color: z.string().nullish(), size: z.string().nullish(),
  variantId: z.string().nullish(), ram: z.string().nullish(), storage: z.string().nullish(), kgenVariantId: z.string().nullish(),
  packSize: z.union([z.string(), z.number()]).nullish(), validityYears: z.union([z.string(), z.number()]).nullish(),
}))

const RecoverySchema = z.object({
  savedAt: z.number(),
  receipt: z.object({
    razorpay_order_id: z.string().min(1).max(100), razorpay_payment_id: z.string().min(1).max(100),
    razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/), checkoutToken: z.string().min(20).max(100),
  }),
  orderData: z.record(z.unknown()),
})
export type CheckoutRecovery = z.infer<typeof RecoverySchema>
const key = (owner: string) => `sara_checkout_payment:${owner}`

export function paymentRecoveryStorageAvailable(owner: string): boolean {
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try { window[kind].setItem(`${key(owner)}:probe`, "1"); window[kind].removeItem(`${key(owner)}:probe`); return true } catch { /* Try the other storage. */ }
  }
  return false
}
export function saveCheckoutRecovery(owner: string, recovery: CheckoutRecovery): boolean {
  let saved = false
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try { window[kind].setItem(key(owner), JSON.stringify(recovery)); saved = true } catch { /* Retain the other copy. */ }
  }
  return saved
}
export function readCheckoutRecovery(owner: string): CheckoutRecovery | null {
  const copies: CheckoutRecovery[] = []
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try {
      const stored = window[kind].getItem(key(owner))
      const parsed = stored ? RecoverySchema.safeParse(JSON.parse(stored)) : null
      if (parsed?.success) copies.push(parsed.data)
    } catch { /* Try the other storage. */ }
  }
  return copies.sort((a, b) => b.savedAt - a.savedAt)[0] || null
}
export function clearCheckoutRecovery(owner: string) {
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try { window[kind].removeItem(key(owner)) } catch { /* Clear the other copy. */ }
  }
}

const HostedRecoverySchema = z.object({
  orderId: z.string().min(1), checkoutToken: z.string().min(20), storeOrderId: z.string().min(1),
  guestAccessToken: z.string().optional(),
  total: z.number().finite().nonnegative(), tax: z.number().finite().nonnegative(), shipping: z.number().finite().nonnegative(),
  items: PurchasedItemsSchema.optional(), owner: z.string().optional(), savedAt: z.number().default(0),
})
export type HostedCheckoutRecovery = z.infer<typeof HostedRecoverySchema>
const hostedKey = "sara_hosted_checkout"

export function readHostedCheckout(): HostedCheckoutRecovery | null {
  const copies: HostedCheckoutRecovery[] = []
  let invalid = false
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try {
      const stored = window[kind].getItem(hostedKey)
      if (!stored) continue
      const parsed = HostedRecoverySchema.safeParse(JSON.parse(stored))
      if (parsed.success) copies.push(parsed.data)
      else invalid = true
    } catch { invalid = true }
  }
  if (copies.length) return copies.sort((a, b) => b.savedAt - a.savedAt)[0]
  if (invalid) throw new Error("Previous payment details could not be read. Contact support before paying again.")
  return null
}

export function saveHostedCheckout(value: z.input<typeof HostedRecoverySchema>): boolean {
  const stored = JSON.stringify({ ...value, savedAt: Date.now() })
  let saved = false
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try { window[kind].setItem(hostedKey, stored); saved = true } catch { /* Try the other storage. */ }
  }
  return saved
}

export function clearHostedCheckout() {
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try { window[kind].removeItem(hostedKey) } catch { /* Try the other copy. */ }
  }
}
