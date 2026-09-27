import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/brand-guidelines",
  title: (brand) => `Brand Guidelines | ${brand}`,
  description:
    "Logo usage, colour palette, typography and tone-of-voice guidelines for the Sara Electronics brand.",
})

export default function BrandGuidelinesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
