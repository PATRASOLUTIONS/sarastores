import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"
import VendorClientShell from "./vendor-client-shell"

export const generateMetadata = pageMetadata({
  path: "/vendor", title: brand => `Vendor Portal | ${brand}`,
  description: "Private SARA vendor portal for managing your product catalogue.",
  noIndex: true,
})

export default function VendorLayout({ children }: { children: ReactNode }) {
  return <VendorClientShell>{children}</VendorClientShell>
}
