import { z } from "zod"
import { productSpecificationResponseSchema } from "./product-specification-response"

/**
 * A descriptive list that the catalogue may hold as a single value.
 *
 * `characteristics` is the warehouse CHAR DESC column, and 659 of 1,175
 * products store it as a plain string ("4K", "Front Loading") — which is what
 * the rest of the codebase expects too: cleanProductName.ts types it
 * `string | null`, and the product write path assigns `canonical.charDesc`.
 * Declaring it a strict array meant `.parse()` threw on more than half the
 * catalogue, and because the product page parses before it renders, every one
 * of those detail pages died with "Product information could not be loaded".
 *
 * Accepting both shapes and normalising to an array keeps consumers simple.
 * `specification_images` below already took this approach for the same reason.
 */
const stringList = () =>
  z.union([z.string(), z.array(z.string())]).nullish()
    .transform(value => (typeof value === "string" ? [value] : value))

export const productCardResponseSchema = z.object({
  id: z.string().min(1),
  slug: z.string().optional(),
  name: z.string(),
  description: z.string().nullish().transform(value => value ?? undefined),
  price: z.number(),
  image: z.string().nullish().transform(value => value || "/placeholder.svg"),
  stock: z.number().nullish().transform(value => value ?? undefined),
  category: z.string().nullish().transform(value => value ?? undefined),
  // Division → Category → Segment is the merchandising hierarchy behind the
  // header menu and the listing filters. Both may be unset on a product that
  // has not been classified yet.
  division: z.string().nullish().transform(value => value ?? undefined),
  segment: z.string().nullish().transform(value => value ?? undefined),
  brand: z.string().nullish().transform(value => value ?? undefined),
  originalPrice: z.number().nullish().transform(value => value ?? undefined),
  specification_images: z.union([z.string(), z.array(z.string())]).nullish().transform(value => value ?? undefined),
  sku: z.string().optional(),
  technical_details: z.record(z.unknown()).nullish().transform(value => value ?? undefined),
  trusted: z.boolean().optional(),
  mrp: z.number().nullish().transform(value => value ?? undefined),
  raw: z.record(z.unknown()).nullish().transform(value => value ?? undefined),
  subCategory: z.string().nullish(),
  manufacturerName: z.string().nullish(),
  manufacturer_name: z.string().nullish(),
  active: z.boolean().optional(),
})

export type ProductCardResponse = z.infer<typeof productCardResponseSchema>

export const subCategoryProductResponseSchema = productCardResponseSchema.extend({
  description: z.string().nullish().transform(value => value ?? ""),
  type: z.string().nullish(),
}).passthrough()
export type SubCategoryProductResponse = z.infer<typeof subCategoryProductResponseSchema>

export const productDetailResponseSchema = productCardResponseSchema.extend({
  images: stringList(),
  features: stringList(),
  characteristics: stringList(),
  brand: z.string().nullish(),
  groupName: z.string().nullish(),
  inStock: z.boolean().optional(),
  rating: z.union([z.number(), z.string()]).nullish(),
  reviewsCount: z.union([z.number(), z.string()]).nullish(),
  reviews: z.union([
    productSpecificationResponseSchema.shape.reviews,
    z.object({ average: z.union([z.number(), z.string()]).optional(), count: z.union([z.number(), z.string()]).optional() }),
    z.number(),
  ]).nullish(),
  from_manufacturer: z.string().nullish(),
  overview: z.string().nullish(),
  included_components: stringList(),
  specification_images: stringList(),
}).passthrough()

export type ProductDetailResponse = z.infer<typeof productDetailResponseSchema>

export const recentlyViewedResponseSchema = z.object({
  products: z.array(productCardResponseSchema),
})

export const productListingResponseSchema = productCardResponseSchema.extend({
  description: z.string().nullish().transform(value => value ?? ""),
  stock: z.number().nullish().transform(value => value ?? 0),
  manufacturer: z.string().nullish().transform(value => value ?? undefined),
  manufacturerName: z.string().nullish().transform(value => value ?? undefined),
  images: z.array(z.string()).nullish().transform(value => value ?? undefined),
  type: z.string().nullish().transform(value => value ?? undefined),
  rating: z.number().nullish().transform(value => value ?? undefined),
  reviewsCount: z.number().nullish().transform(value => value ?? undefined),
  reviewCount: z.number().nullish().transform(value => value ?? undefined),
  reviews: z.union([
    z.number(),
    z.object({ average: z.number().optional(), count: z.number().optional() }),
  ]).nullish().transform(value => value ?? undefined),
  subCategory: z.string().nullish().transform(value => value ?? undefined),
  groupName: z.string().nullish().transform(value => value ?? undefined),
  createdAt: z.union([z.string(), z.number()]).nullish().transform(value => value ?? undefined),
  updatedAt: z.union([z.string(), z.number()]).nullish().transform(value => value ?? undefined),
}).passthrough()
export const productListingListResponseSchema = z.array(productListingResponseSchema)
export type ProductListingResponse = z.infer<typeof productListingResponseSchema>

export const partnerAssignmentProductResponseSchema = productListingResponseSchema.extend({
  brand: z.string().nullish().transform(value => value ?? undefined),
  images: z.array(z.string()).nullish().transform(value => value ?? undefined),
})
export const partnerAssignmentsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    partnerId: z.string(),
    products: z.array(z.object({
      productId: z.string().min(1), enabled: z.boolean(),
      customPrice: z.number().finite().min(0).optional(),
      customCommission: z.number().finite().min(0).max(100).optional(),
    })),
    enabledProductDetails: z.array(partnerAssignmentProductResponseSchema),
  }),
})
export type PartnerAssignmentProductResponse = z.infer<typeof partnerAssignmentProductResponseSchema>
