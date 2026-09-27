import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/partner-api-docs",
  title: (brand) => `Partner API Documentation | ${brand}`,
  description: "Integration reference for Sara Electronics partner API consumers.",
  noIndex: true,
})

export default function PartnerApiDocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
