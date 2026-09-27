import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/lg",
  title: (brand) => `LG Electronics — TVs, Refrigerators, Washing Machines & ACs | ${brand}`,
  description:
    "Buy LG televisions, refrigerators, washing machines and air conditioners at Sara Electronics. OLED and QNED TVs, frost-free refrigerators and inverter ACs with full LG warranty and no-cost EMI.",
})

export default function LgLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
