import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/tcl",
  title: (brand) => `TCL TVs & Appliances — 4K, QLED and Smart TVs | ${brand}`,
  description:
    "Browse TCL televisions and home appliances. Compare available models and current prices, and check product-specific warranty, payment and installation terms.",
})

export default function TclLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
