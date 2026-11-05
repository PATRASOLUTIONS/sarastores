import { z } from "zod"
import { BannerScheduleFields } from "@/lib/banner-schedule"

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
  imageWidth: z.number().positive().optional(),
  imageHeight: z.number().positive().optional(),
  bgFrom: optionalText,
  bgTo: optionalText,
  accent: optionalText,
  dark: z.boolean().optional(),
  bullets: z.array(z.string()).optional(),
  order: z.number().optional(),
  active: z.boolean().optional(),
  startsAt: BannerScheduleFields.startsAt.removeDefault(),
  expiresAt: BannerScheduleFields.expiresAt.removeDefault(),
  weekdays: BannerScheduleFields.weekdays.removeDefault(),
})
export type SiteBanner = z.infer<typeof siteBannerResponseSchema>
export const siteBannerListResponseSchema = z.array(siteBannerResponseSchema)

