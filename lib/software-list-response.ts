import { z } from "zod"

// Public presentation fields only. License keys and provider internals are excluded.
export const publicSoftwareProductSchema = z.object({
  id: z.string().min(1), name: z.string(), description: z.string().default(""),
  shortDescription: z.string().default(""), category: z.string().default("Software"),
  image: z.string().default(""), features: z.array(z.string()).default([]),
  systemRequirements: z.object({ os: z.array(z.string()).default([]), processor: z.string().default(""),
    ram: z.string().default(""), storage: z.string().default("") }).default({}),
  pricing: z.object({ pack1: z.number().default(0), pack2: z.number().default(0), pack3: z.number().default(0),
    pack4: z.number().default(0), pack5: z.number().default(0) }).default({}),
  validityPeriods: z.object({ oneYear: z.number().default(0), twoYear: z.number().default(0), threeYear: z.number().default(0),
    fourYear: z.number().default(0), fiveYear: z.number().default(0) }).default({}),
  status: z.string(), totalKeysAvailable: z.number().default(0),
})
export type PublicSoftwareProduct = z.infer<typeof publicSoftwareProductSchema>
