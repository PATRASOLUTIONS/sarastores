import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/epic-sale",
  title: (brand) => `Epic Sale — Electronics & Appliance Offers | ${brand}`,
  description:
    "Browse available electronics and appliances at current catalogue prices. Compare listed savings and check payment, delivery and installation terms before ordering.",
})

export default function EpicSaleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
