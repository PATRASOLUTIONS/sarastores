"use client"

import useSWR from "swr"

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
] as const

export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number]

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  hero: "Listing page — hero",
  promo: "Listing page — promo tile",
  "home-hero": "Home — hero slide",
  "home-strip": "Home — full-width strip",
  "home-duo": "Home — half-width pair",
  "home-card": "Home — small card",
  "home-statement": "Home — closing statement band",
  "pdp-offer": "Product page — offer card",
  "pdp-rail": "Product page — side rail card",
  "brands-hero": "Brands page — hero",
}

export type SiteBanner = {
  id: string
  placement: BannerPlacement
  scope?: string
  title: string
  subtitle?: string
  script?: string
  ctaText?: string
  ctaLink?: string
  image?: string
  bgFrom?: string
  bgTo?: string
  accent?: string
  dark?: boolean
  bullets?: string[]
  order?: number
  active?: boolean
}

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : []))

/**
 * Banners with an empty `scope` show everywhere; otherwise the scope must match
 * the caller's context (e.g. the active category on a listing page).
 */
export function useBanners(placement: BannerPlacement, scope?: string): SiteBanner[] {
  const { data } = useSWR<SiteBanner[]>(`/api/listing-banners?placement=${placement}`, fetcher, {
    revalidateOnFocus: false,
  })

  const all = Array.isArray(data) ? data : []
  const key = (scope || "").trim().toLowerCase()
  const scoped = key ? all.filter((b) => (b.scope || "").trim().toLowerCase() === key) : []
  return scoped.length > 0 ? scoped : all.filter((b) => !(b.scope || "").trim())
}

export function bannerGradient(banner: Pick<SiteBanner, "bgFrom" | "bgTo">) {
  return {
    backgroundImage: `linear-gradient(115deg, ${banner.bgFrom || "#1560BD"}, ${banner.bgTo || "#0B3C87"})`,
  }
}
