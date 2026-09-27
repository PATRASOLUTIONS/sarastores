import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/tcl",
  title: (brand) => `TCL TVs & Appliances — 4K, QLED and Smart TVs | ${brand}`,
  description:
    "Shop TCL 4K, QLED and Google TVs plus home appliances at Sara Electronics. Big-screen televisions at competitive prices with full manufacturer warranty, no-cost EMI and free installation.",
})

export default function TclLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
