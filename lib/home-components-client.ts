import { z } from "zod"
import { apiFetchJson } from "./api-client"
import { productCardResponseSchema } from "./product-card-response"

const homeSectionFields = {
  id: z.string().min(1),
  title: z.string().nullish().transform(value => value ?? null),
  enabled: z.boolean().default(true),
  order: z.number().int().nonnegative().default(0),
}
export const homeSectionResponseSchema = z.discriminatedUnion("type", [
  z.object({
    ...homeSectionFields,
    type: z.literal("category"),
    config: z.object({ categoryId: z.string().min(1), productIds: z.array(z.string()).optional() }),
  }).passthrough(),
  z.object({
    ...homeSectionFields,
    type: z.literal("manual"),
    config: z.object({ productIds: z.array(z.string()), categoryId: z.string().optional() }),
  }).passthrough(),
])
export type HomeSection = z.infer<typeof homeSectionResponseSchema>
export const homeSectionListResponseSchema = z.array(homeSectionResponseSchema)
export const homeSectionUpdateResponseSchema = z.object({ success: z.literal(true), component: homeSectionResponseSchema })
export const homeCategoryListResponseSchema = z.array(z.object({ id: z.string().min(1), name: z.string() }))
export const homeProductListResponseSchema = z.array(productCardResponseSchema.extend({
  image: z.string().nullish().transform(value => value ?? undefined),
  images: z.array(z.string()).nullish().transform(value => value ?? undefined),
}))
export type HomeProduct = z.infer<typeof homeProductListResponseSchema>[number]

export async function updateHomeSection(id: string, updates: Partial<Omit<HomeSection, "id">>): Promise<HomeSection> {
  return apiFetchJson(`/api/home-components?id=${encodeURIComponent(id)}`, {
    method: "PUT",
    json: updates,
  }, value => homeSectionUpdateResponseSchema.parse(value).component)
}
