import type { Metadata } from "next"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"

/**
 * Metadata factory for pages that are client components.
 *
 * A `"use client"` page cannot export `metadata`, so each one needs a sibling
 * server `layout.tsx`. Without it the page silently inherits the root layout's
 * title and description — which means several pages competing in search with
 * the identical homepage title, and no canonical of their own.
 *
 * Usage:
 *   export const generateMetadata = pageMetadata({
 *     path: "/faq",
 *     title: (brand) => `FAQ | ${brand}`,
 *     description: "…",
 *   })
 */
export function pageMetadata(options: {
  path: string
  title: string | ((companyName: string) => string)
  description: string | ((companyName: string) => string)
  /** Transactional, private or utility pages that must stay out of the index. */
  noIndex?: boolean
  imageUrl?: string
}) {
  return async function generateMetadata(): Promise<Metadata> {
    const origin = await getOriginFromHeaders()
    const settings = await getSiteSettings()
    const companyName = getCompanyName(settings)

    return buildPageMetadata({
      title: typeof options.title === "function" ? options.title(companyName) : options.title,
      description:
        typeof options.description === "function"
          ? options.description(companyName)
          : options.description,
      pageUrl: `${origin}${options.path}`,
      origin,
      companyName,
      imageUrl: options.imageUrl,
      noIndex: options.noIndex,
    })
  }
}
