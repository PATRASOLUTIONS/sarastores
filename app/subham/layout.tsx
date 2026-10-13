import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/subham", title: brand => `Shubham World Partnership | ${brand}`,
  description: "Learn about SARA's Shubham World partnership and electronic retail services.",
  noIndex: true,
})

export default function SubhamLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
