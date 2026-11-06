import { z } from "zod"

export const promotionBenefitSchema = z.object({
  id: z.string(), kind: z.enum(["diwali", "gift", "coupon"]), name: z.string(),
  description: z.string(), photo: z.string().nullable(), quantity: z.number().int().positive(),
  expiresAt: z.string().datetime().nullable(), code: z.string().optional(),
  selectionRequired: z.boolean(),
})
export const promotionProductSchema = z.object({
  id: z.string(), name: z.string(), href: z.string().startsWith("/product/"),
  image: z.string().nullable(), price: z.number().positive(),
  benefits: z.array(promotionBenefitSchema),
})
export const storefrontPromotionsSchema = z.object({
  verifiedAt: z.string().datetime(), products: z.array(promotionProductSchema).max(3),
})
export type PromotionBenefit = z.infer<typeof promotionBenefitSchema>
export type PromotionProduct = z.infer<typeof promotionProductSchema>
export type StorefrontPromotions = z.infer<typeof storefrontPromotionsSchema>

export function isPromotionEntryPath(pathname: string | null): boolean {
  return pathname === "/" || /^\/(products|offers|brands|categories|category)(\/|$)/.test(pathname || "")
}

/** Hide stale quotes as well as expired benefits, even when a request fails. */
export function visiblePromotionProducts(snapshot: StorefrontPromotions, now: number): PromotionProduct[] {
  const age = now - Date.parse(snapshot.verifiedAt)
  if (!Number.isFinite(age) || age < 0 || age > 45000) return []
  return snapshot.products.flatMap(product => {
    const benefits = product.benefits.filter(benefit => !benefit.expiresAt || now <= Date.parse(benefit.expiresAt))
    return benefits.length ? [{ ...product, benefits }] : []
  })
}
