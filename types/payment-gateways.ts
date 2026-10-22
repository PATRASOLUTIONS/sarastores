import { z } from "zod"

export const PaymentProviderSchema = z.enum(["pinelabs", "razorpay", "paytm"])
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>
export type HostedPaymentProvider = Exclude<PaymentProvider, "razorpay">

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  razorpay: "Razorpay",
  pinelabs: "Pine Labs",
  paytm: "Paytm",
}

export const PaymentConfigurationSchema = z.object({
  providers: z.array(PaymentProviderSchema),
  defaultProvider: PaymentProviderSchema.nullable(),
  codEnabled: z.boolean(),
  instoreEnabled: z.boolean().default(false),
})

export const HostedCheckoutResponseSchema = z.object({
  success: z.literal(true),
  orderId: z.string().min(1),
  total: z.number().finite().nonnegative(),
  tax: z.number().finite().nonnegative(),
  shipping: z.number().finite().nonnegative(),
  guestAccessToken: z.string().optional(),
  checkout: z.object({
    provider: z.enum(["pinelabs", "paytm"]),
    orderId: z.string().min(1),
    checkoutToken: z.string().min(20),
    redirectUrl: z.string().url(),
    formFields: z.record(z.string()).optional(),
  }),
})

export const HostedPaymentStatusSchema = z.object({
  status: z.enum(["pending", "failed", "completed", "review"]),
  orderId: z.string(),
})
