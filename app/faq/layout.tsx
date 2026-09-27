import type React from "react"
import { pageMetadata } from "@/lib/seo-page"
import { buildFaqJsonLd } from "@/lib/faq-data"

export const generateMetadata = pageMetadata({
  path: "/faq",
  title: (brand) => `Frequently Asked Questions | ${brand}`,
  description:
    "Answers on ordering, payment, EMI, delivery, order tracking, replacements, warranty, store pickup and returns at Sara Electronics.",
})

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Emitted server-side from the same source the page renders. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />
      {children}
    </>
  )
}
