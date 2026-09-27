import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/epic-sale",
  title: (brand) => `Epic Sale — Biggest Electronics Savings Event | ${brand}`,
  description:
    "The Sara Epic Sale is live. Deep discounts on televisions, refrigerators, washing machines, air conditioners and mobiles, with no-cost EMI, bank offers and free installation.",
})

export default function EpicSaleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
