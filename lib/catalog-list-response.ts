import { z } from "zod"

export const catalogCategoryResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string().nullish().transform(value => value ?? undefined),
  description: z.string().nullish().transform(value => value ?? ""),
  image: z.string().nullish().transform(value => value ?? ""),
  isEnabled: z.boolean().optional(),
  icon: z.string().nullish().transform(value => value ?? undefined),
})
export type CatalogCategoryResponse = z.infer<typeof catalogCategoryResponseSchema>
export const catalogCategoryListResponseSchema = z.array(catalogCategoryResponseSchema)
export const catalogSubCategoryListResponseSchema = z.array(z.object({
  name: z.string(),
  slug: z.string().nullish(),
}))

export const homeSubCategoryListResponseSchema = z.array(z.object({
  name: z.string(),
  image: z.string().nullish(),
}).passthrough())
const homeBrandListSchema = z.array(z.object({
  name: z.string(),
  slug: z.string().nullish(),
  logo: z.string().nullish(),
  enabled: z.boolean().nullish(),
  active: z.boolean().nullish(),
}).passthrough())
export const homeBrandListResponseSchema = z.union([
  homeBrandListSchema,
  z.object({ brands: homeBrandListSchema }).transform(value => value.brands),
])
export const homeBrandImageListResponseSchema = z.object({
  brands: z.array(z.object({
    name: z.string(),
    image: z.string().nullish(),
  })),
})
const homeStoreListSchema = z.array(z.object({
  name: z.string(),
}).passthrough())
export const homeStoreListResponseSchema = z.union([
  homeStoreListSchema,
  z.object({ stores: homeStoreListSchema }).transform(value => value.stores),
])
