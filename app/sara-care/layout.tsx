import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/sara-care",
  title: brand => `Sara Care Device Protection | ${brand}`,
  description: "Learn about optional Sara Care protection for eligible devices, available durations, product-dependent prices and coverage terms.",
})

export default function SaraCareLayout({ children }: { children: ReactNode }) {
  return children
}
