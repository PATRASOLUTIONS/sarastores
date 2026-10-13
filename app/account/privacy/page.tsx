import { pageMetadata } from "@/lib/seo-page"
import PrivacyCentreClient from "./privacy-client"

export const generateMetadata = pageMetadata({
  path: "/account/privacy", title: brand => `Privacy & Your Data | ${brand}`,
  description: "Manage your personal data and privacy requests in your SARA account.",
  noIndex: true,
})

export default function AccountPrivacyPage() {
  return <PrivacyCentreClient />
}
