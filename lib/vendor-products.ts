import { ObjectId, type Filter } from "mongodb"
import { z } from "zod"
import { nameSchema } from "@/lib/validation"

export const VendorProductSchema = z.object({
  name: nameSchema,
  description: z.string().trim().min(1).max(20000),
  price: z.coerce.number().finite().nonnegative(),
  stock: z.coerce.number().int().nonnegative().max(1000000),
  image: z.string().max(2000).optional(),
  category: z.string().trim().max(200).optional(),
})

export interface VendorProductRecord {
  _id: ObjectId | string
  vendorId?: string
  [key: string]: unknown
}

export function vendorProductFilter(
  id: string,
  user: { id: string; role: string },
): Filter<VendorProductRecord> {
  const identity: Filter<VendorProductRecord> = {
    $or: [
      ...(ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : []),
      { _id: id },
      { id },
    ],
  }
  if (user.role === "admin" || user.role === "superadmin") return identity
  return { $and: [identity, { vendorId: user.id }] }
}
