import type { Partner } from "./types"
import { z } from "zod"

export type RazorpayIntegration = NonNullable<Partner["razorpayIntegration"]>
export const publicRazorpayIntegrationSchema = z.object({
  enabled: z.boolean(),
  paymentMode: z.enum(["wallet", "direct"]),
  commissionPercent: z.number().finite().min(0).max(100),
  allowedDomains: z.array(z.string()),
  defaultEnvironment: z.enum(["test", "live"]).default("test"),
  webhookSecret: z.string().optional(),
  razorpayAccountId: z.string().optional(),
  razorpayAccountStatus: z.enum(["pending", "active", "inactive"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  credentials: z.object({
    test: z.object({ keyId: z.string().optional() }).optional(),
    live: z.object({ keyId: z.string().optional() }).optional(),
  }).optional(),
})
export type PublicRazorpayIntegration = z.infer<typeof publicRazorpayIntegrationSchema>

export function publicRazorpayIntegration(integration: RazorpayIntegration | undefined) {
  if (!integration) return { enabled: false, paymentMode: "wallet", commissionPercent: 0, allowedDomains: [], defaultEnvironment: "test" }
  return {
    enabled: integration.enabled,
    paymentMode: integration.paymentMode,
    commissionPercent: integration.commissionPercent,
    allowedDomains: integration.allowedDomains,
    defaultEnvironment: integration.defaultEnvironment ?? "test",
    webhookSecret: integration.webhookSecret,
    razorpayAccountId: integration.razorpayAccountId,
    razorpayAccountStatus: integration.razorpayAccountStatus,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
    credentials: {
      test: integration.credentials?.test ? { keyId: integration.credentials.test.keyId } : undefined,
      live: integration.credentials?.live ? { keyId: integration.credentials.live.keyId } : undefined,
    },
  }
}
