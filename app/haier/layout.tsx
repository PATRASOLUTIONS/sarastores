import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/haier",
  title: (brand) => `Haier Appliances — Refrigerators, ACs, Washing Machines | ${brand}`,
  description:
    "Browse Haier refrigerators, air conditioners, washing machines and televisions. Check current prices, availability and payment, warranty and installation terms.",
})

export default function HaierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
