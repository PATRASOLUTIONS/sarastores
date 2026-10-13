import { z } from "zod"

const optionalText = z.string().nullish().transform(value => value ?? undefined)
export const licenseKeyListResponseSchema = z.object({
  success: z.literal(true),
  keys: z.array(z.object({
    id: z.string().min(1),
    key: z.string(),
    status: z.enum(["available", "assigned", "expired", "revoked"]),
    validityYears: z.number().optional(),
    maxDevices: z.number().optional().default(1),
    assignedTo: z.object({
      customerName: optionalText,
      customerEmail: optionalText,
      orderNumber: optionalText,
    }).nullish().transform(value => value ?? undefined),
    assignedAt: optionalText,
    expiresAt: optionalText,
  })),
})
export type LicenseKeyResponse = z.infer<typeof licenseKeyListResponseSchema>["keys"][number]
export const licenseKeyMutationResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
})
