import { z } from "zod"

export const STORE_PAYMENT_PLATFORMS = [
  { id: "razorpay", label: "Razorpay" },
  { id: "phonepe", label: "PhonePe" },
  { id: "gpay", label: "Google Pay" },
  { id: "paytm", label: "Paytm" },
  { id: "pinelabs", label: "Pine Labs" },
  { id: "upi", label: "Other UPI app" },
  { id: "card", label: "Card / POS machine" },
  { id: "other", label: "Other" },
] as const

export const StorePaymentPlatformSchema = z.enum(
  STORE_PAYMENT_PLATFORMS.map(platform => platform.id) as [
    (typeof STORE_PAYMENT_PLATFORMS)[number]["id"],
    ...(typeof STORE_PAYMENT_PLATFORMS)[number]["id"][],
  ],
)
export type StorePaymentPlatform = z.infer<typeof StorePaymentPlatformSchema>

export function storePaymentPlatformLabel(id: string | undefined): string {
  return STORE_PAYMENT_PLATFORMS.find(platform => platform.id === id)?.label ?? id ?? "Unknown"
}

export const StorePaymentTransactionSchema = z.object({
  platform: StorePaymentPlatformSchema,
  transactionId: z.string().trim()
    .min(4, "Enter the transaction ID from your payment receipt")
    .max(80, "Transaction ID is too long")
    .regex(/^[A-Za-z0-9._/-]+$/, "Transaction ID can only contain letters, numbers, dot, dash, slash or underscore"),
})

/** Accepts "+91 98765-43210" style input and stores the bare 10-digit mobile. */
export const WhatsAppNumberSchema = z.string().trim()
  .transform(value => value.replace(/[\s()-]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian WhatsApp number"))

/** Who gets the pay-at-store WhatsApp when a customer places the order. */
export const StorePaymentWhatsAppSettingsSchema = z.object({
  notifyStoreManager: z.boolean().default(true),
  /** Store id -> manager WhatsApp; stores without an entry use their listed mobile number. */
  storeManagers: z.record(z.string().regex(/^[a-f0-9]{24}$/, "Invalid store"), WhatsAppNumberSchema).default({})
    .refine(value => Object.keys(value).length <= 500, "Too many stores"),
  platformManagers: z.array(z.object({
    name: z.string().trim().min(1, "Enter the manager's name").max(80),
    phone: WhatsAppNumberSchema,
  }).strict()).max(20, "Add at most 20 platform managers").default([]),
}).strict().transform(value => ({
  ...value,
  platformManagers: value.platformManagers.filter((manager, index, list) =>
    list.findIndex(other => other.phone === manager.phone) === index),
}))
export type StorePaymentWhatsAppSettings = z.infer<typeof StorePaymentWhatsAppSettingsSchema>

/** GET /api/admin/store-payment-whatsapp also lists stores so the admin can see who will be messaged. */
export const StorePaymentWhatsAppAdminSchema = z.object({
  settings: StorePaymentWhatsAppSettingsSchema,
  stores: z.array(z.object({ id: z.string(), name: z.string(), city: z.string(), listedPhone: z.string() })),
  templates: z.object({ store: z.boolean(), platformManager: z.boolean(), customer: z.boolean() }),
})

/** Returned by POST /api/payment/store-request. */
export const StorePaymentRequestResponseSchema = z.object({
  success: z.literal(true),
  requestId: z.string().min(1),
  requestToken: z.string().min(1),
  store: z.object({ id: z.string(), name: z.string(), phone: z.string() }),
  notified: z.object({ whatsapp: z.boolean(), email: z.boolean(), managers: z.number().int().nonnegative().optional() }),
})
export type StorePaymentRequestResponse = z.infer<typeof StorePaymentRequestResponseSchema>
