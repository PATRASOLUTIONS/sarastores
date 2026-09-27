"use client"

import Link from "next/link"
import { ArrowRight, Check, LayoutGrid } from "lucide-react"
import { bannerGradient, useBanners, type SiteBanner } from "@/hooks/useBanners"
import { categoryIcon } from "@/lib/category-icons"

const isUrl = (value?: string) => !!value && /^(https?:)?\/\/|^\//.test(value)

export type Tile = { label: string; image?: string; href: string }

/** Row of round category shortcuts directly under the hero. */
export function CategoryRail({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null

  return (
    <section className="section-container -mt-4 relative z-10" aria-label="Shop by category">
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-4 shadow-sm">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tiles.map(({ label, image, href }) => {
            const Icon = categoryIcon(label)
            return (
              <Link
                key={label}
                href={href}
                className="group flex w-[92px] flex-shrink-0 flex-col items-center gap-2 rounded-lg px-1 py-2 transition-colors hover:bg-gray-50"
              >
                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-gray-50 text-black">
                  {isUrl(image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" aria-hidden className="h-full w-full object-contain p-1" />
                  ) : (
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                  )}
                </span>
                <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-gray-700 group-hover:text-[#1560BD]">
                  {label}
                </span>
              </Link>
            )
          })}

          <Link
            href="/store-locator"
            className="group flex w-[92px] flex-shrink-0 flex-col items-center gap-2 rounded-lg px-1 py-2 transition-colors hover:bg-gray-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-black">
              <LayoutGrid className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <span className="text-center text-[11px] font-medium leading-tight text-gray-700 group-hover:text-[#1560BD]">
              View All Stores
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Full-width campaign strip (the "Super Sunday" band in the design). */
export function PromoStrip({ banner }: { banner: SiteBanner }) {
  const light = !banner.dark

  return (
    <section className="section-container" aria-label={banner.title}>
      <div
        className="relative flex min-h-[168px] items-center overflow-hidden rounded-xl"
        style={bannerGradient(banner)}
      >
        <div className={`relative z-10 w-full px-6 py-6 sm:w-[58%] ${light ? "text-white" : "text-[#0F2557]"}`}>
          <h2 className="font-heading text-2xl font-extrabold uppercase leading-tight tracking-tight sm:text-[34px]">
            {banner.title}
          </h2>
          {banner.subtitle && (
            <p className="mt-1.5 text-sm font-semibold" style={{ color: banner.accent || "#E11D2E" }}>
              {banner.subtitle}
            </p>
          )}

          {banner.bullets && banner.bullets.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {banner.bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} style={{ color: banner.accent || "#E11D2E" }} />
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          {banner.ctaText && (
            <Link
              href={banner.ctaLink || "/products"}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#1560BD] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
            >
              {banner.ctaText}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {banner.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image}
            alt=""
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-2 hidden h-[150px] w-[42%] object-contain object-right-bottom sm:block"
          />
        )}
      </div>
    </section>
  )
}

/** Two equal campaign panels side by side. */
export function PromoDuo({ banners }: { banners: SiteBanner[] }) {
  if (banners.length === 0) return null

  return (
    <section className="section-container grid gap-4 md:grid-cols-2" aria-label="Featured offers">
      {banners.slice(0, 2).map((banner) => {
        const light = !banner.dark
        return (
          <div
            key={banner.id}
            className="relative flex min-h-[190px] items-center overflow-hidden rounded-xl"
            style={bannerGradient(banner)}
          >
            <div className={`relative z-10 w-[62%] px-5 py-6 ${light ? "text-white" : "text-[#0F2557]"}`}>
              <h3 className="font-heading text-xl font-extrabold uppercase leading-tight sm:text-2xl">
                {banner.title}
              </h3>
              {banner.subtitle && (
                <p className={`mt-1.5 text-sm font-medium ${light ? "text-white/90" : "text-slate-600"}`}>
                  {banner.subtitle}
                </p>
              )}

              {banner.bullets && banner.bullets.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {banner.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-1.5 text-[11px] font-semibold">
                      <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                        <Check className="h-2 w-2" strokeWidth={4} style={{ color: banner.accent || "#E11D2E" }} />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}

              {banner.ctaText && (
                <Link
                  href={banner.ctaLink || "/offers"}
                  className={`mt-4 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-transform hover:scale-[1.03] ${
                    light ? "bg-white text-[#0F2557]" : "bg-[#0F2557] text-white"
                  }`}
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
                className="pointer-events-none absolute bottom-0 right-0 h-[160px] w-[44%] object-contain object-right-bottom"
              />
            )}
          </div>
        )
      })}
    </section>
  )
}

/** Closing brand statement band. */
export function StatementBand({ banner }: { banner: SiteBanner }) {
  return (
    <section className="section-container" aria-label={banner.title}>
      <div
        className="relative overflow-hidden rounded-xl px-6 py-10 sm:px-10 sm:py-12"
        style={bannerGradient(banner)}
      >
        {banner.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-35 sm:block"
          />
        )}

        <div className="relative z-10 max-w-xl text-white">
          <h2 className="font-heading text-2xl font-bold leading-tight sm:text-[32px]">{banner.title}</h2>
          {banner.subtitle && <p className="mt-3 text-sm text-white/80">{banner.subtitle}</p>}
          {banner.ctaText && (
            <Link
              href={banner.ctaLink || "/about"}
              className="mt-6 inline-flex items-center gap-2 rounded-md border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-[#0F2557]"
            >
              {banner.ctaText}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {banner.script && (
          <p className="absolute bottom-8 right-8 z-10 hidden max-w-[200px] text-right font-script text-2xl leading-tight text-white lg:block">
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

export function useHomeBanners() {
  return {
    strip: useBanners("home-strip"),
    duo: useBanners("home-duo"),
    cards: useBanners("home-card"),
    statement: useBanners("home-statement"),
  }
}
