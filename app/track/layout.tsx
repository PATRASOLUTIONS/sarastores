import type React from "react"
import { pageMetadata } from "@/lib/seo-page"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export const generateMetadata = pageMetadata({
  path: "/track",
  title: (brand) => `Track Your Order | ${brand}`,
  description: "Enter your order number to see the latest status and delivery updates.",
  noIndex: true,
})

export default async function TrackLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSession())) redirect("/login?redirect=/track")
  return <>{children}</>
}
