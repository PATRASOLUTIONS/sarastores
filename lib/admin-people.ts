import { z } from "zod"

export const AdminPersonSchema = z.object({
  id: z.string(), userId: z.string().nullable(), name: z.string(), email: z.string(),
  role: z.string(), status: z.string(), phone: z.string(), address: z.string(), createdAt: z.string(),
  dashboardAccess: z.boolean(), allowedPages: z.array(z.string()),
  storeAccess: z.enum(["none", "selected", "all"]), storeIds: z.array(z.string()),
  staffProfiles: z.array(z.object({ id: z.string(), employeeId: z.string(), name: z.string(), email: z.string(), department: z.string(), role: z.string() })),
  orders: z.number().nonnegative(), totalSpent: z.number().nonnegative(),
})
export const AdminPeopleResponseSchema = z.object({ items: z.array(AdminPersonSchema), total: z.number().int().nonnegative() })
export type AdminPerson = z.infer<typeof AdminPersonSchema>
