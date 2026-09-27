import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/complaints",
  title: (brand) => `Raise a Complaint or Service Request | ${brand}`,
  description:
    "Report a defective product, breakage, wrong item or service issue to Sara Electronics. Track your complaint status and get support from your nearest store.",
})

export default function ComplaintsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
