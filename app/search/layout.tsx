import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/search", title: brand => `Product Search | ${brand}`,
  description: "Search the product catalogue.", noIndex: true,
})

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children
}
