import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/error", title: brand => `Return to Store | ${brand}`,
  description: "Return to the store homepage.", noIndex: true,
})

export default function ErrorLayout({ children }: { children: ReactNode }) {
  return children
}
