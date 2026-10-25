import { z } from "zod"

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
})

export type CheckoutDraft = z.infer<typeof checkoutDraftSchema>
const draftKey = (owner: string) => `sara_checkout_details:${owner}`

export function readCheckoutDraft(owner: string): CheckoutDraft | null {
  try {
    const stored = sessionStorage.getItem(draftKey(owner))
    if (!stored) return null
    const parsed = checkoutDraftSchema.safeParse(JSON.parse(stored))
    return parsed.success ? parsed.data : null
  } catch { return null }
}

export function saveCheckoutDraft(owner: string, draft: CheckoutDraft) {
  try { sessionStorage.setItem(draftKey(owner), JSON.stringify(draft)) }
  catch { /* Storage may be unavailable; the form still works in memory. */ }
}

export function clearCheckoutDraft(owner: string) {
  try { sessionStorage.removeItem(draftKey(owner)) }
  catch { /* Storage may be unavailable. */ }
}
