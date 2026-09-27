import type { Metadata } from "next"
import PreferencesClient from "@/app/account/preferences/preferences-client"

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
}

export default function DashboardNotificationsPage() {
  return <PreferencesClient />
}
