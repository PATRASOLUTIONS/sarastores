import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/lucky-draw",
  noIndex: true,
  title: (brand) => `Lucky Draw - Archived Campaign | ${brand}`,
  description:
    "Archived information for the Shubham Lucky Draw campaign advertised from 15 January to 28 February 2026. Entries are closed; contact our team about previous entries.",
})

export default function LuckyDrawLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
