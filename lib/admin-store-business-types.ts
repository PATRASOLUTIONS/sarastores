import { z } from "zod"
import { StoreBusinessSchema } from "@/lib/store-business-types"

export const AdminStoreBusinessResponseSchema = z.object({
  success: z.literal(true), checkedAt: z.string(), business: StoreBusinessSchema,
  store: z.object({ id: z.string(), name: z.string(), code: z.string(), address: z.string(), phone: z.string(),
    hours: z.string(), image: z.string(), mapUrl: z.string(), placeId: z.string(), active: z.boolean(), locationType: z.string() }),
})
export type AdminStoreBusinessResponse = z.infer<typeof AdminStoreBusinessResponseSchema>

export const GoogleStoreInventorySchema = z.object({ success: z.literal(true), stores: z.array(
  AdminStoreBusinessResponseSchema.shape.store.pick({ id: true, name: true, code: true, address: true, active: true, locationType: true }),
) })
export type GoogleStoreSummary = z.infer<typeof GoogleStoreInventorySchema>["stores"][number]
