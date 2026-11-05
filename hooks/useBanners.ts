"use client"

import useSWR from "swr"
import { useEffect, useState } from "react"
import { BANNER_UPDATE_KEY, nextBannerTransition, selectVisibleBanners } from "@/lib/banner-schedule"
import { siteBannerListResponseSchema, type SiteBanner, type BannerPlacement } from "@/lib/site-banners"
export { BANNER_PLACEMENTS, BANNER_PLACEMENT_LABELS, siteBannerResponseSchema, siteBannerListResponseSchema } from "@/lib/site-banners"
export type { SiteBanner, BannerPlacement } from "@/lib/site-banners"

const fetcher = async (url: string): Promise<SiteBanner[]> => {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error(`Could not load banners (${response.status})`)
  const data: unknown = await response.json()
  return siteBannerListResponseSchema.parse(data)
}
const EMPTY_BANNERS: SiteBanner[] = []

/**
 * Banners with an empty `scope` show everywhere; otherwise the scope must match
 * the caller's context (e.g. the active category on a listing page).
 */
export function useBanners(placement: BannerPlacement, scope?: string, initialData?: SiteBanner[], initialNow?: number): SiteBanner[] {
  const { data, mutate } = useSWR<SiteBanner[]>(`/api/listing-banners?placement=${placement}&schedule=1`, fetcher, {
    fallbackData: initialData,
    revalidateOnMount: initialData === undefined,
    revalidateOnFocus: true,
    refreshInterval: initialData === undefined ? 30000 : 60000,
    onError: (error: unknown) => console.error("[Banners] Loading failed:", error),
  })

  const now = useBannerClock(data || EMPTY_BANNERS, initialNow)
  useEffect(() => {
    const refresh = (event: StorageEvent) => { if (event.key === BANNER_UPDATE_KEY) void mutate() }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [mutate])
  return selectVisibleBanners(Array.isArray(data) ? data : [], scope, now)
}

export function useBannerClock(data: SiteBanner[], initialNow?: number) {
  const [now, setNow] = useState(initialNow ?? Date.now)
  useEffect(() => { setNow(Date.now()) }, [data])
  useEffect(() => {
    const transition = nextBannerTransition(data || [], Date.now())
    if (transition === null) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(1, transition - Date.now() + 1), 2_147_483_000))
    return () => window.clearTimeout(timer)
  }, [data, now])
  return now
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
