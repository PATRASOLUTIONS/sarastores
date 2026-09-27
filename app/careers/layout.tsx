import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/careers",
  title: (brand) => `Careers | ${brand}`,
  description:
    "Build your career with SARA. Explore roles across retail, service, logistics and e-commerce, and register your interest with our hiring team.",
})

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
