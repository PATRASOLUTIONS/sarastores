"use client"

import useSWR from "swr"
import { z } from "zod"
import { useEffect, useState } from "react"
import { BANNER_UPDATE_KEY, selectVisibleBanners } from "@/lib/banner-schedule"

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
  "home-strip": "Home — below-deals row (strip artwork)",
  "home-duo": "Home — side / sub banners",
  "home-card": "Home — below-deals banners",
  "home-statement": "Home — below-deals row (statement artwork)",
  "pdp-offer": "Product page — offer cards above detail tabs",
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
  expiresAt: z.string().datetime({ offset: true }).nullish(),
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
  const { data, mutate } = useSWR<SiteBanner[]>(`/api/listing-banners?placement=${placement}`, fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 30000,
    onError: (error: unknown) => console.error("[Banners] Loading failed:", error),
  })

  const now = useBannerClock(data || [])
  useEffect(() => {
    const refresh = (event: StorageEvent) => { if (event.key === BANNER_UPDATE_KEY) void mutate() }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [mutate])
  return selectVisibleBanners(Array.isArray(data) ? data : [], scope, now)
}

export function useBannerClock(data: SiteBanner[]) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const deadlines = (data || []).filter(banner => banner.active).map(banner => Date.parse(banner.expiresAt || '')).filter(time => time > now)
    if (!deadlines.length) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(1, Math.min(...deadlines) - Date.now() + 1), 2_147_483_000))
    return () => window.clearTimeout(timer)
  }, [data, now])
  return Math.max(now, Date.now())
}

export function bannerIsPhotoOnly(banner: Pick<SiteBanner, "title" | "subtitle" | "script" | "ctaText" | "bullets" | "image">) {
  const copy = [banner.title, banner.subtitle, banner.script, banner.ctaText, ...(banner.bullets || [])]
  return Boolean((banner.image || "").trim()) && copy.every(value => !(value || "").trim())
}

export function bannerGradient(banner: Pick<SiteBanner, "bgFrom" | "bgTo">) {
  return {
    backgroundImage: `linear-gradient(115deg, ${banner.bgFrom || "#1560BD"}, ${banner.bgTo || "#0B3C87"})`,
  }
}
