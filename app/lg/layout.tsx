import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/lg",
  title: (brand) => `LG Electronics — TVs, Refrigerators, Washing Machines & ACs | ${brand}`,
  description:
    "Browse LG televisions, refrigerators, washing machines and air conditioners. Compare available models and current prices, with product-specific warranty and payment terms.",
})

export default function LgLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
