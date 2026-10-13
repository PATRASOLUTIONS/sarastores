import { z } from "zod"

const imageSchema = z.string().min(1).max(7 * 1024 * 1024).regex(/^(?:data:image\/|https?:\/\/|\/)/)
export const heroSlideFieldsSchema = z.object({
  title: z.string().max(500), subtitle: z.string().max(2000), image: imageSchema,
  cta: z.string().max(120), link: z.string().max(2048).refine(value => !value || /^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value), "Invalid slide link"),
  active: z.boolean(), order: z.number().int().nonnegative().max(10000).optional(),
  titlePosition: z.string().max(100).optional(), subtitlePosition: z.string().max(100).optional(),
  buttonPosition: z.string().max(100).optional(),
})
export const heroSlideMutationSchema = heroSlideFieldsSchema.partial().extend({
  id: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
}).strict()
export const heroSlideResponseSchema = heroSlideFieldsSchema.extend({
  id: z.string().min(1), title: z.string().default(""), subtitle: z.string().default(""),
  cta: z.string().default("Shop Now"), link: z.string().default("/products"), active: z.boolean().default(true),
  feature: z.object({
    type: z.enum(["product", "category", "subcategory"]), name: z.string(), image: z.string().nullable(),
    price: z.number().finite().nullable(), mrp: z.number().finite().nullable(), caption: z.string().nullable(),
  }).nullable().optional(),
})
export const heroSlideListSchema = z.array(heroSlideResponseSchema)
export const heroSlideSaveSchema = z.object({ success: z.literal(true), slide: heroSlideResponseSchema })
export type HeroSlide = z.infer<typeof heroSlideResponseSchema>
