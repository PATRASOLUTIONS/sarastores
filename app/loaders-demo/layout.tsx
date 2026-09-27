import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/loaders-demo",
  title: "Loader Demo",
  description: "Internal component demo.",
  noIndex: true,
})

export default function LoadersDemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
