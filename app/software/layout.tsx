import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/software",
  title: (brand) => `Antivirus & Software — Genuine Licences | ${brand}`,
  description:
    "Buy genuine antivirus and software licences from Sara Electronics. Instant activation keys delivered by email, multi-device packs and multi-year validity options.",
})

export default function SoftwareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
