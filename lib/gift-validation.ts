import { z } from "zod"

export const GiftSkuSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9._-]{0,99}$/, "Enter a SKU using letters, numbers, dots, hyphens or underscores")
const photo = z.string().trim().min(1, "Add a gift photo").max(2800000).refine(value =>
  /^\/(?!\/)/.test(value) || /^https:\/\//i.test(value) || /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value), "Choose an image file or an HTTPS image URL")
const money = z.number().finite().nonnegative().max(5000000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use at most two decimal places")
const fields = z.object({ sku: GiftSkuSchema, name: z.string().trim().min(1).max(150), photo, price: money, mrp: money, active: z.boolean().default(true) })
export const CreateGiftSchema = fields.strict().refine(value => value.mrp >= value.price, { path: ["mrp"], message: "MRP must be at least the price" })
export const GiftResponseSchema = fields.extend({ id: z.string() })
export const GiftListSchema = z.object({ success: z.literal(true), gifts: z.array(GiftResponseSchema) })
export type Gift = z.infer<typeof GiftResponseSchema>

export const GiftAwardSchema = z.object({
  promotionId: z.string(), code: z.string(), promotionName: z.string(), giftId: z.string(), sku: z.string(),
  name: z.string(), photo: z.string(), price: money, mrp: money, quantity: z.number().int().min(1).max(100),
})
export type GiftAward = z.infer<typeof GiftAwardSchema>
export const GiftAwardsResponseSchema = z.object({ success: z.literal(true), gifts: z.array(GiftAwardSchema) })
export const DeclinedGiftPromotionsSchema = z.array(z.string().max(100)).max(100).default([])
export const ExpectedGiftsSchema = z.array(GiftAwardSchema.pick({ promotionId: true, giftId: true, sku: true, quantity: true })).max(100)
export function giftSelectionSignature(gifts: { promotionId: string; giftId: string; sku: string; quantity: number }[]) {
  return JSON.stringify([...gifts].sort((a, b) => a.promotionId.localeCompare(b.promotionId))
    .map(gift => ({ promotionId: gift.promotionId, giftId: gift.giftId, sku: gift.sku, quantity: gift.quantity })))
}
