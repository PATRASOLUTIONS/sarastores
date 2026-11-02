import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/bosch",
  title: (brand) => `Bosch Home Appliances — Washing Machines, Dishwashers & More | ${brand}`,
  description:
    "Browse Bosch washing machines, dishwashers, refrigerators and kitchen appliances. Check available models, current prices and product-specific warranty and service terms.",
})

export default function BoschLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
