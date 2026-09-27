import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

// A comparison set is per-visitor and infinitely variable, so it is a tool
// rather than a page worth indexing.
export const generateMetadata = pageMetadata({
  path: "/compare",
  title: (brand) => `Compare Products | ${brand}`,
  description: "Compare specifications, prices and features side by side before you buy.",
  noIndex: true,
})

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
