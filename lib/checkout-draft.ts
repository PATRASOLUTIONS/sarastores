import { z } from "zod"
import { PaymentProviderSchema } from "@/types/payment-gateways"
import { StorePaymentPlatformSchema, StorePaymentRequestResponseSchema } from "@/types/store-payment"

export const EMPTY_CHECKOUT_CUSTOMER = {
  firstName: "", lastName: "", email: "", phone: "", address: "",
  city: "", state: "Karnataka", pincode: "", country: "India", employeeId: "",
}

// Drafts must accept unfinished/invalid input. Checkout validates it again
// before an address is saved or an order/payment is submitted.
const checkoutDraftSchema = z.object({
  version: z.literal(1),
  customer: z.object({
    firstName: z.string(), lastName: z.string(), email: z.string(), phone: z.string(),
    address: z.string(), city: z.string(), state: z.string(), pincode: z.string(),
    country: z.string(), employeeId: z.string(),
  }),
  editedFields: z.array(z.string()).default([]),
  continueAsGuest: z.boolean(),
  editingAddress: z.boolean(),
  addressType: z.enum(["home", "work", "other"]),
  selectedAddressId: z.string().nullable(),
  couponCode: z.string(),
  appliedCoupon: z.object({ code: z.string(), name: z.string(), couponRemovable: z.boolean().default(true) }).nullable().default(null),
  savedAt: z.number().nonnegative().default(0),
  fulfilmentMethod: z.enum(["delivery", "pickup"]).default("delivery"),
  pickupStore: z.object({ id: z.string(), name: z.string(), address: z.string(), city: z.string(), phone: z.string(), hours: z.string(),
    storeCode: z.string().optional(), state: z.string().optional(), pincode: z.string().optional(), image: z.string().optional(),
  }).nullable().default(null),
  deliveryFallbackStoreId: z.string().nullable().default(null),
  paymentMethod: z.enum(["online", "store-payment"]).default("online"),
  paymentProvider: PaymentProviderSchema.nullable().default(null),
  redeemPoints: z.number().int().nonnegative().max(1000000).default(0),
  storeRequest: StorePaymentRequestResponseSchema.nullable().default(null),
  storeRequestContext: z.string().nullable().default(null),
  storeTransaction: z.object({ platform: z.union([StorePaymentPlatformSchema, z.literal("")]), transactionId: z.string() })
    .default({ platform: "", transactionId: "" }),
})

export type CheckoutDraft = z.infer<typeof checkoutDraftSchema>
export type CheckoutDraftInput = z.input<typeof checkoutDraftSchema>
const draftKey = (owner: string) => `sara_checkout_details:${owner}`

export function readCheckoutDraft(owner: string): CheckoutDraft | null {
  try {
    const drafts: CheckoutDraft[] = []
    for (const kind of ["localStorage", "sessionStorage"] as const) {
      try {
        const stored = window[kind].getItem(draftKey(owner))
        if (!stored) continue
        const parsed = checkoutDraftSchema.safeParse(JSON.parse(stored))
        if (parsed.success) drafts.push(parsed.data)
      } catch { /* Try the other browser storage when one is unavailable. */ }
    }
    return drafts.sort((a, b) => b.savedAt - a.savedAt)[0] || null
  } catch { return null }
}

export function saveCheckoutDraft(owner: string, draft: CheckoutDraftInput): boolean {
  const stored = JSON.stringify({ ...draft, savedAt: Date.now() })
  let saved = false
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try { window[kind].setItem(draftKey(owner), stored); saved = true }
    catch { /* Try both; report failure instead of claiming the draft is saved. */ }
  }
  return saved
}

export function clearCheckoutDraft(owner: string) {
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try { window[kind].removeItem(draftKey(owner)) } catch { /* The other copy is still cleared. */ }
  }
}
