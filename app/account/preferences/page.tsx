import { pageMetadata } from "@/lib/seo-page"
import PreferencesClient from "./preferences-client"

export const generateMetadata = pageMetadata({
  path: "/account/preferences", title: brand => `Communication Preferences | ${brand}`,
  description: "Manage the communication preferences and consent for your SARA account.",
  noIndex: true,
})

export default function PreferencesPage() {
  return <PreferencesClient />
}
