import { CheckoutContactSchema, GuestCheckoutCustomerSchema } from "@/lib/validation"
import { getPincodeRestrictions } from "@/lib/pincode-store"
import { isDeliveryRegionAllowed, isPincodeAllowed } from "@/lib/pincode-policy"

export async function validateCheckoutCustomer(customer: unknown, method: string = "delivery", guest = false) {
  const parsed = (guest || method !== "pickup" ? GuestCheckoutCustomerSchema : CheckoutContactSchema).safeParse(customer)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  if (method !== "pickup") {
    const address = GuestCheckoutCustomerSchema.parse(customer)
    const rules = await getPincodeRestrictions()
    if (!isDeliveryRegionAllowed(rules.mode, address.city, address.state) || !isPincodeAllowed(rules, address.zipCode)) {
      return { ok: false as const, error: "Home delivery is not available at this address. Choose a supported address or store pickup." }
    }
  }
  return { ok: true as const, customer: parsed.data }
}
