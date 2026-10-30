import type { AuthSession } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"

/** Attach unowned storefront orders using the verified account email only. */
export async function linkGuestOrdersToAccount(user: AuthSession["user"]): Promise<void> {
  if (user.emailVerified !== true || !user.id || !user.email?.trim()) return

  const email = user.email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const orders = await getCollection("orders")
  await orders.updateMany(
    {
      userId: { $in: [null, ""] },
      customerId: { $in: [null, ""] },
      partnerId: { $in: [null, ""] },
      "customer.email": { $regex: `^\\s*${email}\\s*$`, $options: "i" },
    },
    // Keep checkout ownership intact: pending payment intents still have userId=null.
    { $set: { customerId: user.id, guestLinkedAt: new Date() } },
  )
}
