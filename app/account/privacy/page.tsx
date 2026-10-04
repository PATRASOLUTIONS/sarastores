import type { Metadata } from "next"
import PrivacyCentreClient from "./privacy-client"

export const metadata: Metadata = {
  title: "Privacy & your data",
  robots: { index: false, follow: false },
}

export default function AccountPrivacyPage() {
  return <PrivacyCentreClient />
}
