import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/lucky-draw",
  title: (brand) => `Lucky Draw — Win Electronics Prizes | ${brand}`,
  description:
    "Take part in the Sara Electronics lucky draw for a chance to win televisions, appliances and vouchers. Enter with your purchase and check your result instantly.",
})

export default function LuckyDrawLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
