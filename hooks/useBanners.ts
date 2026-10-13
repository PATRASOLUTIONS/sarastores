"use client"

import useSWR from "swr"
import { z } from "zod"

export const BANNER_PLACEMENTS = [
  "hero",
  "promo",
  "home-hero",
  "home-strip",
  "home-duo",
  "home-card",
  "home-statement",
  "pdp-offer",
  "pdp-rail",
  "brands-hero",
  "cart-promo",
] as const

export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number]

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  hero: "Listing page — hero",
  promo: "Listing page — promo tile",
  "home-hero": "Home — main poster carousel",
  "home-strip": "Home — full-width strip",
  "home-duo": "Home — side / sub banners",
  "home-card": "Home — below-deals banners",
  "home-statement": "Home — closing statement band",
  "pdp-offer": "Product page — offer card",
  "pdp-rail": "Product page — side rail card",
  "brands-hero": "Brands page — hero",
  "cart-promo": "Cart — promotional banner",
}

const optionalText = z.string().nullish().transform(value => value ?? undefined)
export const siteBannerResponseSchema = z.object({
  id: z.string().min(1),
  placement: z.enum(BANNER_PLACEMENTS),
  scope: optionalText,
  title: z.string(),
  subtitle: optionalText,
  script: optionalText,
  ctaText: optionalText,
  ctaLink: optionalText,
  image: optionalText,
  bgFrom: optionalText,
  bgTo: optionalText,
  accent: optionalText,
  dark: z.boolean().optional(),
  bullets: z.array(z.string()).optional(),
  order: z.number().optional(),
  active: z.boolean().optional(),
})
export type SiteBanner = z.infer<typeof siteBannerResponseSchema>
export const siteBannerListResponseSchema = z.array(siteBannerResponseSchema)

const fetcher = async (url: string): Promise<SiteBanner[]> => {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error(`Could not load banners (${response.status})`)
  const data: unknown = await response.json()
  return siteBannerListResponseSchema.parse(data)
}

/**
 * Banners with an empty `scope` show everywhere; otherwise the scope must match
 * the caller's context (e.g. the active category on a listing page).
 */
export function useBanners(placement: BannerPlacement, scope?: string): SiteBanner[] {
  const { data } = useSWR<SiteBanner[]>(`/api/listing-banners?placement=${placement}`, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 30000,
    onError: (error: unknown) => console.error("[Banners] Loading failed:", error),
  })

  const all = Array.isArray(data) ? data.filter((banner) => banner.active === true) : []
  const key = (scope || "").trim().toLowerCase()
  const scoped = key ? all.filter((b) => (b.scope || "").trim().toLowerCase() === key) : []
  return scoped.length > 0 ? scoped : all.filter((b) => !(b.scope || "").trim())
}

export function bannerGradient(banner: Pick<SiteBanner, "bgFrom" | "bgTo">) {
  return {
    backgroundImage: `linear-gradient(115deg, ${banner.bgFrom || "#1560BD"}, ${banner.bgTo || "#0B3C87"})`,
  }
}
