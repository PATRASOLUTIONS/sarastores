"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { bannerGradient, useBanners, type SiteBanner } from "@/hooks/useBanners"
import { BadgeCheck, CreditCard, Cpu, Layers } from "lucide-react"

const PROOF_ICONS = [Cpu, Layers, CreditCard, BadgeCheck]

const FALLBACK: SiteBanner = {
  id: "fallback",
  placement: "home-hero",
  title: "Technology Brings People Closer",
  subtitle: "Mobiles | Electronics | Home Appliances | More",
  script: "Happier Homes Brighter Lives",
  ctaText: "Shop Now",
  ctaLink: "/products",
  image: "/banners/mixed-lineup.svg",
  bgFrom: "#EAF2FC",
  bgTo: "#F7FAFF",
  accent: "#E11D2E",
  dark: true,
  bullets: ["Latest Technology", "Wide Range of Brands", "Easy EMI Options", "Trusted Since 25 Years"],
}

export default function LandingHero() {
  const banners = useBanners("home-hero")
  const slides = banners.length > 0 ? banners : [FALLBACK]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000)
    return () => clearInterval(timer)
  }, [slides.length])

  const slide = slides[Math.min(index, slides.length - 1)]
  const light = !slide.dark
  const go = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length)

  return (
    <section className="relative overflow-hidden" style={bannerGradient(slide)} aria-label={slide.title}>
      <div className="section-container relative grid items-center gap-6 py-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:px-14">
        <div className={light ? "text-white" : "text-[#0F2557]"}>
          {slide.script && (
            <p className="font-script text-[26px] leading-none text-[#0F2557] md:text-3xl">
              {slide.script.split(" ").slice(0, 2).join(" ")}
              <br />
              {slide.script.split(" ").slice(2).join(" ")}
              <svg viewBox="0 0 140 12" className="mt-1 h-2.5 w-32" fill="none" aria-hidden>
                <path
                  d="M2 9C30 3 74 2 104 4c12 .8 24 2.6 34 5"
                  stroke={slide.accent || "#E11D2E"}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </p>
          )}

          <h1 className="mt-4 font-heading text-[32px] font-extrabold leading-[1.08] tracking-tight md:text-5xl">
            {slide.title}
          </h1>

          {slide.subtitle && (
            <p className={`mt-3 text-sm md:text-base ${light ? "text-white/85" : "text-slate-600"}`}>
              {slide.subtitle}
            </p>
          )}

          {slide.bullets && slide.bullets.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-4">
              {slide.bullets.slice(0, 4).map((bullet, i) => {
                const Icon = PROOF_ICONS[i % PROOF_ICONS.length]
                return (
                  <li key={bullet} className="flex w-[98px] flex-col items-center gap-1.5 text-center">
                    <Icon className={`h-6 w-6 ${light ? "text-white" : "text-[#0F2557]"}`} strokeWidth={1.5} />
                    <span className="text-[11px] font-semibold leading-tight">{bullet}</span>
                  </li>
                )
              })}
            </ul>
          )}

          {slide.ctaText && (
            <Link
              href={slide.ctaLink || "/products"}
              className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#1560BD] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            >
              {slide.ctaText}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className="relative hidden items-center justify-center lg:flex">
          {slide.image && (
            // Hero artwork may be an uploaded photo of any ratio or a bundled SVG.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.image} alt="" aria-hidden className="h-[260px] w-full object-contain" />
          )}

          <div className="absolute -top-1 right-0 flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full bg-[#0F2557] text-center text-white shadow-lg ring-4 ring-[#D4A221]">
            <span className="font-heading text-lg font-extrabold leading-none">25</span>
            <span className="text-[8px] font-bold uppercase tracking-wider">Years</span>
            <span className="text-[8px] uppercase tracking-wider text-white/70">of Trust</span>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </section>
  )
}
