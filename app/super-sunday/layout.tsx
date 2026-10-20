import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/super-sunday",
  title: brand => `Super Sunday Deals | ${brand}`,
  description: "Shop the products selected for the SARA Super Sunday sale.",
})

export default function SuperSundayLayout({ children }: { children: ReactNode }) {
  return children
}
