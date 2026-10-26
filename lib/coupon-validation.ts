import { z } from "zod"

const date = z.union([z.string().max(64), z.date(), z.null()]).optional()
  .transform(value => value == null || value === "" ? null : new Date(value))
  .refine(value => value === null || Number.isFinite(value.getTime()), "Invalid coupon date")
const ids = z.array(z.string().trim().min(1).max(200)).max(5000).default([])
const limit = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullish().transform(value => value ?? 0)

const fields = z.object({
  code: z.string().trim().toUpperCase().min(3).max(50).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(100),
  type: z.enum(["fixed", "percentage", "buy_get", "buy_get_product"]),
  value: z.number().finite().nonnegative().default(0),
  maxDiscount: z.number().finite().positive().nullish().transform(value => value ?? null),
  applyScope: z.enum(["all", "products", "categories", "brands", "skus", "divisions"]).default("all"),
  productIds: ids,
  categoryIds: ids,
  brands: ids,
  skus: ids,
  divisions: ids,
  giftId: z.string().trim().max(100).nullish().transform(value => value?.toUpperCase() || null),
  startDate: date,
  endDate: date,
  noEndDate: z.boolean().default(false),
  usageLimit: limit,
  perCustomerLimit: limit,
  buyQty: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullish().transform(value => value ?? null),
  getQty: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullish().transform(value => value ?? null),
  active: z.boolean().default(true),
})

type CouponInput = z.infer<typeof fields>
function validateCoupon(value: CouponInput, context: z.RefinementCtx) {
  const issue = (path: string, message: string) => context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
  if (!["buy_get", "buy_get_product"].includes(value.type) && value.value <= 0) issue("value", "Discount value must be positive")
  if (value.type === "percentage" && value.value > 100) issue("value", "Percentage cannot exceed 100")
  if (["buy_get", "buy_get_product"].includes(value.type) && (!value.buyQty || !value.getQty || !Number.isSafeInteger(value.buyQty + value.getQty))) {
    issue("buyQty", "Valid positive Buy and Get quantities are required")
  }
  if (value.type === "buy_get_product") {
    if (!["all", "products", "skus", "divisions"].includes(value.applyScope)) issue("applyScope", "Choose all products, specific products, SKUs or divisions for free gifts")
    if (!value.giftId) issue("giftId", "Select the free gift SKU")
    if (!value.startDate) issue("startDate", "Choose Valid from")
    if (!value.noEndDate && !value.endDate) issue("endDate", "Choose Valid until or select no end date")
    if ((value.buyQty || 0) > 1000 || (value.getQty || 0) > 100) issue("buyQty", "Buy quantity must be at most 1,000 and gift quantity at most 100")
  }
  if (!value.noEndDate && value.startDate && value.endDate && value.endDate < value.startDate) {
    issue("endDate", "End date must not precede start date")
  }
  const selection = {
    all: null, products: value.productIds, categories: value.categoryIds, brands: value.brands, skus: value.skus, divisions: value.divisions,
  }[value.applyScope]
  if (selection && selection.length === 0) issue("applyScope", "Choose at least one eligible item for this scope")
}

export const CreateCouponSchema = fields.strict().superRefine(validateCoupon)
// Unknown and usage/identity fields cannot enter a partial update.
export const CouponPatchSchema = fields.partial().strict().refine(value => Object.keys(value).length > 0, "No coupon changes supplied")
export const StoredCouponFieldsSchema = fields.superRefine(validateCoupon)
export const CouponResponseSchema = fields.extend({
  id: z.string().min(1),
  usageCount: z.number().int().nonnegative().default(0),
}).passthrough().transform(value => ({
  ...value, startDate: value.startDate?.toISOString() ?? null, endDate: value.endDate?.toISOString() ?? null,
}))
export const CouponListSchema = z.object({ success: z.literal(true), coupons: z.array(CouponResponseSchema) })
export const CouponMutationSchema = z.object({ success: z.literal(true), coupon: CouponResponseSchema })
export const CouponDeleteSchema = z.object({ success: z.literal(true) })
export const CouponQuoteSchema = z.object({
  success: z.literal(true), code: z.string().min(1), name: z.string(), discount: z.number().finite().positive(),
})
