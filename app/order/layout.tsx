import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

// Guest orders are reachable by capability token; they must never be indexed.
export const generateMetadata = pageMetadata({
  path: "/order",
  title: (brand) => `Your Order | ${brand}`,
  description: "View your order details.",
  noIndex: true,
})

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
