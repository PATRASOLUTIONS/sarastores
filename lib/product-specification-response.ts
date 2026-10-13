import { z } from "zod"

const reviewSchema = z.object({
  rating: z.union([z.number(), z.string()]).nullish(),
  title: z.string().optional(),
  text: z.string().optional(),
  body: z.string().optional(),
  content: z.string().optional(),
  author: z.union([z.string(), z.object({ name: z.string().optional() })]).optional(),
  name: z.string().optional(),
  date: z.string().optional(),
  createdAt: z.string().optional(),
  id: z.string().optional(),
  verified: z.boolean().optional(),
  isVerifiedPurchase: z.boolean().optional(),
  images: z.array(z.string()).optional(),
}).passthrough()

export const productSpecificationResponseSchema = z.object({
  _id: z.unknown().optional(),
  sku: z.string().optional(),
  asin: z.string().optional(),
  product_id: z.unknown().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).nullish(),
  printedprice: z.union([z.string(), z.number()]).nullish(),
  mrp: z.union([z.string(), z.number()]).nullish(),
  printedmrp: z.union([z.string(), z.number()]).nullish(),
  source: z.string().optional(),
  source_url: z.string().optional(),
  updatedAt: z.union([z.string(), z.number(), z.object({ $date: z.union([z.string(), z.number()]) })]).optional(),
  images: z.unknown().optional(),
  data: z.object({ images: z.unknown().optional() }).optional(),
  bullet_points: z.array(z.string()).nullish(),
  technical_details: z.record(z.unknown()).nullish(),
  specification_images: z.array(z.string()).nullish(),
  reviews: z.array(reviewSchema).nullish(),
  additional_info: z.record(z.unknown()).nullish(),
  from_manufacturer: z.string().nullish(),
}).passthrough()

export type ProductSpecificationResponse = z.infer<typeof productSpecificationResponseSchema>

export async function fetchProductSpecification(url: string): Promise<ProductSpecificationResponse | null> {
  const response = await fetch(url, { cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Product details could not be loaded")
  const data: unknown = await response.json()
  if (data === null) return null
  const parsed = productSpecificationResponseSchema.safeParse(Array.isArray(data) ? data[0] : data)
  if (!parsed.success) {
    console.error("[Product details] Invalid specification response", parsed.error.flatten())
    throw new Error("Product details response is invalid")
  }
  return parsed.data
}
