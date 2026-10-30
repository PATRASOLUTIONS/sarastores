import { z } from "zod"
import { MAX_PURCHASE_QUANTITY } from "@/lib/purchase-validation"

// Store durations in years for compatibility with existing orders; accept whole months.
export const SaraCareYearsSchema = z.number().finite().positive().max(50)
  .refine(years => Math.abs(years * 12 - Math.round(years * 12)) < 0.000001, "Duration must be a whole number of months")
export type SaraCareYears = z.infer<typeof SaraCareYearsSchema>
export const SaraCareMasterPlanSchema = z.object({ years: SaraCareYearsSchema,
  percentage: z.number().finite().positive().max(100).optional(),
  value: z.number().finite().positive().max(10000000).optional(),
  code: z.string().trim().min(1).max(200),
}).refine(plan => plan.percentage !== undefined || plan.value !== undefined, "A plan rate or value is required")
export type SaraCareMasterPlan = z.infer<typeof SaraCareMasterPlanSchema>
export type SaraCareMasterRow = { itemno: string; name: string; plans: SaraCareMasterPlan[] }
export const normalizeCareItemno = (value: unknown) => String(value ?? "").trim().toUpperCase()
export const SaraCareReferenceSchema = z.object({
  parentLineKey: z.string().min(1).max(3000),
  durationYears: SaraCareYearsSchema,
})
export const SaraCareSnapshotSchema = SaraCareReferenceSchema.extend({
  parentProductId: z.string(), parentSku: z.string().nullable(), parentName: z.string(),
  basis: z.enum(["price", "mrp"]), basisAmount: z.number().finite().positive(),
  percentage: z.number().finite().positive(), ruleId: z.string(), revision: z.string(),
  terms: z.string(), coverageStarts: z.enum(["purchase", "delivery"]),
  taxRate: z.literal(18),
  planCode: z.string().optional(),
  pricingMode: z.enum(["percentage", "value"]).optional(),
})
export type SaraCareSnapshot = z.infer<typeof SaraCareSnapshotSchema>
export const SaraCareInputFields = {
  saraCare: SaraCareReferenceSchema.optional(),
  saraCareSelection: SaraCareYearsSchema.nullable().optional(),
}
// Quote only needs device identity and selection; keep checkout/payment modules
// out of this read-only endpoint's dependency graph.
export const SaraCareQuoteRequestSchema = z.object({ items: z.array(z.object({
  ...SaraCareInputFields,
  id: z.string().min(1).max(200).optional(), productId: z.string().min(1).max(200).optional(),
  quantity: z.number().int().min(1).max(MAX_PURCHASE_QUANTITY),
  type: z.string().max(50).nullish(), sku: z.string().max(200).nullish(),
  variantId: z.string().max(200).nullish(), color: z.string().max(100).nullish(), size: z.string().max(100).nullish(),
  ram: z.string().max(100).nullish(), storage: z.string().max(100).nullish(), kgenVariantId: z.string().max(200).nullish(),
  packSize: z.union([z.string(), z.number()]).nullish(), validityYears: z.union([z.string(), z.number()]).nullish(),
}).refine(item => !!(item.id || item.productId), "Product ID is required")).min(1).max(40) })

export const SaraCareRuleSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(100),
  scope: z.enum(["product", "segment", "category", "division"]),
  productId: z.string().max(200).default(""),
  division: z.string().trim().max(150).default(""),
  category: z.string().trim().max(150).default(""),
  segment: z.string().trim().max(150).default(""),
  excluded: z.boolean().default(false),
  basis: z.enum(["price", "mrp"]).default("price"),
  defaultYears: SaraCareYearsSchema.default(1),
  rates: z.array(z.object({ years: SaraCareYearsSchema, percentage: z.number().finite().min(0).max(100), enabled: z.boolean() })).max(100),
}).superRefine((rule, ctx) => {
  if (rule.scope === "product" ? !rule.productId : !rule.division ||
    (rule.scope !== "division" && !rule.category) || (rule.scope === "segment" && !rule.segment)) {
    ctx.addIssue({ code: "custom", message: "Select the complete product group or product.", path: ["scope"] })
  }
  if (new Set(rule.rates.map(rate => rate.years)).size !== rule.rates.length) {
    ctx.addIssue({ code: "custom", message: "Each duration must appear only once.", path: ["rates"] })
  }
  if (!rule.excluded && (!rule.rates.some(rate => rate.enabled && rate.years === rule.defaultYears) ||
    rule.rates.some(rate => rate.enabled && rate.percentage <= 0))) {
    ctx.addIssue({ code: "custom", message: "Enter a positive percentage for each enabled duration and enable the default duration.", path: ["rates"] })
  }
})
export type SaraCareRule = z.infer<typeof SaraCareRuleSchema>
export const saraCareTarget = (rule: SaraCareRule) => JSON.stringify([rule.scope,
  ...(rule.scope === "product" ? [rule.productId] : [rule.division,
    ...(rule.scope !== "division" ? [rule.category] : []), ...(rule.scope === "segment" ? [rule.segment] : [])])
].map(value => value.trim().toLowerCase()))
export const SaraCareConfigSchema = z.object({
  enabled: z.boolean().default(false),
  terms: z.string().trim().max(10000).default(""),
  coverageStarts: z.enum(["purchase", "delivery"]).default("delivery"),
  taxRate: z.literal(18).default(18),
  importId: z.string().max(100).optional(),
  importedProducts: z.number().int().nonnegative().default(0),
  importedPlans: z.number().int().nonnegative().default(0),
  importedFile: z.string().max(300).default(""),
  importedSheet: z.string().max(100).default(""),
  pricingMode: z.enum(["percentage", "value"]).default("percentage"),
  basis: z.enum(["price", "mrp"]).default("price"),
  rules: z.array(SaraCareRuleSchema).max(500).default([]),
}).superRefine((config, ctx) => {
  if (config.enabled && (config.terms.length < 20 || !config.importId || !config.importedPlans)) {
    ctx.addIssue({ code: "custom", message: "Upload product plans and add coverage terms before enabling Sara Care." })
  }
  if (new Set(config.rules.map(saraCareTarget)).size !== config.rules.length || new Set(config.rules.map(rule => rule.id)).size !== config.rules.length) {
    ctx.addIssue({ code: "custom", message: "Duplicate rule targets or IDs are not allowed." })
  }
})
export type SaraCareConfig = z.infer<typeof SaraCareConfigSchema>
export const emptySaraCareConfig: SaraCareConfig = { enabled: false, terms: "", coverageStarts: "delivery", taxRate: 18, rules: [], importedProducts: 0, importedPlans: 0, importedFile: "", importedSheet: "", pricingMode: "percentage", basis: "price" }
export const saraCareDurationLabel = (years: number) => years < 1 || !Number.isInteger(years)
  ? `${Math.round(years * 12)} months` : `${years} ${years === 1 ? "year" : "years"}`
export const saraCareProductId = (years: SaraCareYears) => `sara-care-${years}y`
export const saraCareSku = (years: SaraCareYears) => `SARA-CARE-${years}Y`
export const isSaraCare = (item: { type?: string | null; saraCare?: unknown; serviceKind?: unknown }) =>
  item.type === "service" || item.serviceKind === "sara-care" || !!item.saraCare
export type SaraCareOffer = { parentLineKey: string; defaultYears: SaraCareYears; options: Array<{ years: SaraCareYears; percentage: number; price: number }>; terms: string;
  basis?: "price" | "mrp"; basisAmount?: number; coverageStarts?: "purchase" | "delivery"; taxRate?: 18; pricingMode?: "percentage" | "value" }
export const SaraCareQuoteResponseSchema = z.object({
  offers: z.array(z.object({ parentLineKey: z.string(), defaultYears: SaraCareYearsSchema, terms: z.string(),
    basis: z.enum(["price", "mrp"]).optional(), basisAmount: z.number().positive().optional(),
    coverageStarts: z.enum(["purchase", "delivery"]).optional(), taxRate: z.literal(18).optional(),
    pricingMode: z.enum(["percentage", "value"]).optional(),
    options: z.array(z.object({ years: SaraCareYearsSchema, percentage: z.number(), price: z.number().positive() })) })),
  items: z.array(z.object({ id: z.string(), sku: z.string(), name: z.string(), quantity: z.number().int().positive(),
    price: z.number().positive(), image: z.string(), type: z.literal("service"), color: z.null(), size: z.null(), saraCare: SaraCareSnapshotSchema })),
})
