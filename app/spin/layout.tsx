import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/spin", title: brand => `Spin & Win | ${brand}`,
  description: "Explore the SARA Spin & Win campaign. Check the current campaign's eligibility, participation rules and prize-collection terms.",
  noIndex: true,
})

export default function SpinLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
