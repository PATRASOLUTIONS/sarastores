import type { Metadata } from "next"
import PreferencesClient from "./preferences-client"

export const metadata: Metadata = {
  title: "Communication preferences",
  robots: { index: false, follow: false },
}

export default function PreferencesPage() {
  return <PreferencesClient />
}
