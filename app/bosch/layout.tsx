import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/bosch",
  title: (brand) => `Bosch Home Appliances — Washing Machines, Dishwashers & More | ${brand}`,
  description:
    "Buy Bosch home appliances at Sara Electronics. Washing machines, dishwashers, refrigerators and kitchen appliances with German engineering, full manufacturer warranty, no-cost EMI and free installation.",
})

export default function BoschLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
