import { z } from "zod"

export const imageUploadResponseSchema = z.object({
  images: z.array(z.object({ url: z.string().min(1) })).optional(),
  error: z.string().optional(),
  errors: z.array(z.string()).optional(),
})
