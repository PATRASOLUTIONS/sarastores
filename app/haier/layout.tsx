import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/haier",
  title: (brand) => `Haier Appliances — Refrigerators, ACs, Washing Machines | ${brand}`,
  description:
    "Shop Haier refrigerators, air conditioners, washing machines and televisions at Sara Electronics. Authorised dealer pricing, full warranty, no-cost EMI and free installation across Karnataka.",
})

export default function HaierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
