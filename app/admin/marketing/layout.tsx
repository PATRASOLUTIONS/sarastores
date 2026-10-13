import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/admin/marketing", title: brand => `Marketing & Controls | ${brand}`,
  description: "Manage storefront marketing content, page sections, promotional banners and campaign tools.", noIndex: true,
})
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
