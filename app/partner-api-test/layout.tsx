import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/partner-api-test", title: brand => `Partner API Tester | ${brand}`,
  description: "Internal testing tools for the SARA partner API.",
  noIndex: true,
})

export default function PartnerApiTestLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
