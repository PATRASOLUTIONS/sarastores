import { z } from "zod"

const googleUrl = z.string().url().refine(value => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password &&
      (url.hostname === "google.com" || url.hostname.endsWith(".google.com"))
  } catch { return false }
})
export const StoreBusinessSchema = z.object({
  status: z.enum(["connected", "not_configured", "unavailable"]),
  name: z.string(), address: z.string(), phone: z.string(), hours: z.array(z.string()),
  mapsUrl: googleUrl, reviewsUrl: googleUrl, writeReviewUrl: googleUrl.nullable(),
  rating: z.number().min(0).max(5).nullable(), reviewCount: z.number().int().nonnegative().nullable(),
  reviews: z.array(z.object({ author: z.string(), authorUrl: googleUrl.nullable(), rating: z.number().min(0).max(5), text: z.string(), date: z.string() })),
})
export const StoreBusinessResponseSchema = z.object({ success: z.literal(true), business: StoreBusinessSchema })
export type StoreBusiness = z.infer<typeof StoreBusinessSchema>
