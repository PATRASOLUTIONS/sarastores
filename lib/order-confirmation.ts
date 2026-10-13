import { z } from "zod"

const text = z.string().nullish()
export const OrderConfirmationSchema = z.object({
  orderId: z.string().min(1),
  status: z.string(),
  createdAt: z.string(),
  total: z.number().finite().nonnegative(),
  shipping: z.number().finite().nonnegative().optional(),
  items: z.array(z.object({
    id: text, productId: text, name: z.string(), image: text,
    price: z.number().finite().nonnegative(), quantity: z.number().int().positive(),
  })),
  customer: z.object({ firstName: text, lastName: text, name: text, email: text, phone: text }).optional(),
  shippingAddress: z.object({ name: text, street: text, city: text, state: text, zip: text, country: text }).optional(),
  paymentMethod: z.string(),
  paymentVerification: z.object({ verified: z.boolean(), checkedAt: text }).nullish(),
  fulfilment: z.object({
    method: z.enum(["delivery", "pickup"]), storeId: text, storeName: text, storeAddress: text,
  }).optional(),
  timeline: z.array(z.object({ status: z.string(), date: text })).optional(),
})

export type OrderConfirmation = z.infer<typeof OrderConfirmationSchema>

export function orderJourneyStage(status: string): number {
  const normalized = status.toLowerCase().replace(/[_-]/g, " ")
  if (normalized.includes("out for delivery")) return 4
  if (normalized === "delivered" || normalized === "collected") return 5
  if (normalized.includes("ship") || normalized.includes("dispatch")) return 3
  if (normalized.includes("pack") || normalized === "ready for pickup") return 2
  return 0
}
