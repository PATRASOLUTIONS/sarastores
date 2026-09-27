"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { bannerGradient, useBanners, type SiteBanner } from "@/hooks/useBanners"

export type ListingBanner = SiteBanner

/** Listing pages only ever render the `hero` and `promo` placements. */
export function useListingBanners(placement: "hero" | "promo", scope?: string) {
  return useBanners(placement, scope)
}

const gradient = bannerGradient

export function ListingHero({ banner }: { banner: ListingBanner }) {
  const light = !banner.dark

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={gradient(banner)}
      aria-label={banner.title}
    >
      <div className="relative grid items-center gap-4 px-6 py-8 sm:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] lg:gap-6 lg:px-10">
        <div className={light ? "text-white" : "text-slate-900"}>
          <h2 className="font-heading text-[28px] font-bold leading-[1.12] sm:text-4xl lg:text-[40px]">
            {banner.title}
          </h2>
          {banner.subtitle && (
            <p className={`mt-3 text-sm sm:text-base ${light ? "text-white/85" : "text-slate-700"}`}>
              {banner.subtitle}
            </p>
          )}
          {banner.ctaText && (
            <Link
              href={banner.ctaLink || "/products"}
              className={`mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.02] ${
                light ? "bg-white text-slate-900" : "bg-slate-900 text-white"
              }`}
            >
              {banner.ctaText}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className="hidden items-center justify-center lg:flex">
          {banner.image && (
            // Decorative artwork; may be an SVG or an uploaded photo of any ratio.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.image} alt="" aria-hidden className="h-[190px] w-full object-contain" />
          )}
        </div>

        {banner.script && (
          <p
            className={`hidden max-w-[190px] pr-2 text-right font-script text-2xl leading-tight xl:block ${
              light ? "text-white" : "text-slate-900"
            }`}
          >
            {banner.script}
            <svg viewBox="0 0 120 12" className="mt-1 ml-auto block h-2.5 w-28" fill="none" aria-hidden>
              <path
                d="M2 9C26 3 62 2 90 4c10 .8 20 2.6 28 5"
                stroke={banner.accent || "#E11D2E"}
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </p>
        )}
      </div>
    </section>
  )
}

export function ListingPromoRow({ banners }: { banners: ListingBanner[] }) {
  if (banners.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {banners.slice(0, 2).map((banner) => {
        const light = !banner.dark
        return (
          <section
            key={banner.id}
            className="relative flex min-h-[132px] items-center overflow-hidden rounded-xl"
            style={gradient(banner)}
            aria-label={banner.title}
          >
            <div className={`relative z-10 max-w-[60%] px-5 py-5 ${light ? "text-white" : "text-slate-900"}`}>
              <p className="font-heading text-base font-extrabold uppercase tracking-wide">{banner.title}</p>
              {banner.subtitle && (
                <p className={`mt-1 text-sm font-semibold leading-snug ${light ? "text-white/90" : "text-slate-700"}`}>
                  {banner.subtitle}
                </p>
              )}
              {banner.ctaText && (
                <Link
                  href={banner.ctaLink || "/products"}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
                  style={{ backgroundColor: banner.accent || "#E11D2E" }}
                >
                  {banner.ctaText}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {banner.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={banner.image}
                alt=""
                aria-hidden
                className="pointer-events-none absolute bottom-0 right-0 h-[112px] w-[46%] object-contain object-right-bottom"
              />
            )}
          </section>
        )
      })}
    </div>
  )
}
