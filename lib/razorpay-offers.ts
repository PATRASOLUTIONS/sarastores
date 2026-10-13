import { z } from "zod"

export const razorpayOfferSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(), bank: z.string(),
  discount_percentage: z.number().nullable(), discount_amount: z.number().nullable(),
  min_amount: z.number().nullable(), max_discount: z.number().nullable(),
  payment_method: z.string(), active: z.boolean(),
  starts_at: z.number().nullish(), ends_at: z.number().nullish(), type: z.string(),
})
export type LiveRazorpayOffer = z.infer<typeof razorpayOfferSchema>
export const razorpayOffersSchema = z.object({ items: z.array(razorpayOfferSchema), source: z.literal("razorpay") })

export function isEmiOffer(offer: LiveRazorpayOffer): boolean {
  return offer.payment_method === "emi" || offer.type === "emi" || /\bemi\b/i.test(`${offer.name} ${offer.description}`)
}

export function isNoCostEmiOffer(offer: LiveRazorpayOffer): boolean {
  return isEmiOffer(offer) && /\bno[\s-]*cost\s+emi\b/i.test(`${offer.name} ${offer.description}`)
}

export function applicableOffers(offers: LiveRazorpayOffer[], amount: number, now = Date.now()): LiveRazorpayOffer[] {
  return offers.filter(offer => offer.active && (!offer.starts_at || offer.starts_at * 1000 <= now) &&
    (!offer.ends_at || offer.ends_at * 1000 > now) && (!offer.min_amount || amount >= offer.min_amount))
}
