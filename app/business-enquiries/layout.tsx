import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/business-enquiries",
  title: (brand) => `Business & Bulk Enquiries | ${brand}`,
  description:
    "Corporate, institutional and bulk purchase enquiries for electronics and appliances, handled by a dedicated SARA team.",
})

export default function BusinessEnquiriesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
