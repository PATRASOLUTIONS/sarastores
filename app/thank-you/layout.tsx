import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/thank-you",
  title: (brand) => `Order Confirmed | ${brand}`,
  description: "Thank you for your order.",
  noIndex: true,
})

export default function ThankYouLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
