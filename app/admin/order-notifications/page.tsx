import { redirect } from "next/navigation"
import { requireFullAdmin } from "@/lib/auth"
import { pageMetadata } from "@/lib/seo-page"
import NotificationSettings from "./notification-settings"

export const generateMetadata = pageMetadata({
  path: "/admin/order-notifications",
  title: brand => `Order notifications | ${brand}`,
  description: "Private administrator settings for confirmed-order notification recipients.",
  noIndex: true,
})

export default async function OrderNotificationsPage() {
  const guard = await requireFullAdmin()
  if (!guard.ok) redirect("/admin/dashboard")
  return <NotificationSettings />
}
