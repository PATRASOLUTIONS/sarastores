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
  statusMessage: z.string().optional(),
  placeId: z.string().optional(),
  googleFields: z.object({ name: z.string().optional(), address: z.string().optional(), phone: z.string().optional(), hours: z.array(z.string()).optional() }).optional(),
  photoMessage: z.string().optional(),
  name: z.string(), address: z.string(), phone: z.string(), hours: z.array(z.string()),
  mapsUrl: googleUrl, reviewsUrl: googleUrl, writeReviewUrl: googleUrl.nullable(),
  embedUrl: googleUrl.optional(),
  photoUrl: z.string().url().refine(value => {
    try { const url = new URL(value); return url.protocol === "https:" && (url.hostname.endsWith(".googleusercontent.com") || url.hostname.endsWith(".ggpht.com")) } catch { return false }
  }).nullable().optional(),
  photoCredits: z.array(z.object({ name: z.string(), url: z.string().url().refine(value => value.startsWith("https://")).optional() })).optional(),
  rating: z.number().min(0).max(5).nullable(), reviewCount: z.number().int().nonnegative().nullable(),
  reviews: z.array(z.object({ author: z.string(), authorUrl: googleUrl.nullable(), rating: z.number().min(0).max(5), text: z.string(), date: z.string() })),
})
export const StoreBusinessResponseSchema = z.object({ success: z.literal(true), business: StoreBusinessSchema })
export type StoreBusiness = z.infer<typeof StoreBusinessSchema>
