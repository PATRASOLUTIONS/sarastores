import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/press",
  title: (brand) => `Press & Media | ${brand}`,
  description:
    "Media enquiries, company boilerplate, brand facts and downloadable logo assets for journalists covering SARA.",
})

export default function PressLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
