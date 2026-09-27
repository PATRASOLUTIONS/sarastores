import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/track",
  title: (brand) => `Track Your Order | ${brand}`,
  description: "Enter your order number to see the latest status and delivery updates.",
  noIndex: true,
})

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
