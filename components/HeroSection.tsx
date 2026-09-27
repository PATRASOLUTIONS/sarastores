"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import { motion, AnimatePresence } from 'framer-motion'
import { durations, easings } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useAnimations'
import CategoryGlyph from '@/components/CategoryGlyph'

interface HeroFeature {
  type: "product" | "category" | "subcategory"
  name: string
  image: string | null
  price: number | null
  mrp: number | null
  caption: string | null
}

interface HeroSlide {
  id: string
  title: string
  subtitle: string
  image: string
  cta: string
  link: string
  active: boolean
  /** Set on generated posters that showcase a product, category or sub-category. */
  feature?: HeroFeature | null
}

// Sub-categories mostly store an emoji in `image` rather than a URL, so the
// hero card has to fall back to a glyph the way SubCategoriesMarquee does.
const isImageUrl = (value: string | null | undefined) =>
  !!value && (value.startsWith("/") || value.startsWith("http") || value.startsWith("data:"))

// Cache configuration
const CACHE_KEY = "hero_slides_cache_v2"
const CACHE_TIMESTAMP_KEY = "hero_slides_cache_timestamp"
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache validity

// Only used when the database has no active slides. Kept out of the initial
// state so no hero art is fetched on the common path.
const fallbackImages: HeroSlide[] = [
  { id: "1", image: "/2imp.webp", title: "", subtitle: "", cta: "", link: "/products", active: true },
  { id: "2", image: "/3imp.webp", title: "", subtitle: "", cta: "", link: "/products", active: true },
  { id: "3", image: "/4imp.webp", title: "", subtitle: "", cta: "", link: "/products", active: true },
]

// Seasonal campaign shown as the lead hero slide. The artwork carries all copy,
// so title/subtitle/cta stay empty (no overlay is drawn over it).
const campaignSlide: HeroSlide = {
  id: "august-freedom-festival",
  image: "/hero/august-sale-banner.svg",
  title: "",
  subtitle: "",
  cta: "",
  link: "/products",
  active: true,
}

// Get cached slides from localStorage
const getCachedSlides = (): HeroSlide[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

    if (cached && timestamp) {
      const cacheAge = Date.now() - parseInt(timestamp, 10)
      // Return cached data even if stale (we'll refresh in background)
      const parsedData = JSON.parse(cached)
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        return parsedData
      }
    }
  } catch (error) {
    console.warn("Error reading hero slides cache:", error)
  }
  return null
}

// Check if cache is still fresh
const isCacheFresh = (): boolean => {
  try {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    if (timestamp) {
      const cacheAge = Date.now() - parseInt(timestamp, 10)
      return cacheAge < CACHE_DURATION
    }
  } catch (error) {
    // Ignore errors
  }
  return false
}

// Save slides to cache
const setCachedSlides = (slides: HeroSlide[]): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(slides))
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    console.warn("Error caching hero slides:", error)
  }
}

export default function HeroSection() {
  // Seed with the seasonal campaign banner so the first paint is never an empty
  // box; admin slides are appended after it once fetched.
  const [slides, setSlides] = useState<HeroSlide[]>([campaignSlide])
  const [activeSlide, setActiveSlide] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const prefersReduced = useReducedMotion()

  // Fetch slides from API
  const fetchSlides = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true)

      // Generated posters take precedence: they are vector, a few KB each, and
      // curated in the admin. Uploaded slides remain the fallback.
      const posterSlides = await fetch("/api/posters", { cache: "default" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) =>
          (data?.posters ?? [])
            .filter((p: { enabled?: boolean }) => p.enabled)
            .map((p: { slug: string; url: string; headline: string; href?: string; feature?: HeroFeature | null }) => ({
              id: `poster-${p.slug}`,
              image: p.url,
              title: "",
              subtitle: "",
              cta: "",
              link: p.href || "/products",
              active: true,
              feature: p.feature ?? null,
            })),
        )
        .catch(() => [])

      const response = await fetch("/api/hero-slides", {
        // Use cache for subsequent requests
        cache: "default",
        next: { revalidate: 300 } // Revalidate every 5 minutes on server
      })

      if (response.ok) {
        const data = await response.json()
        // Filter only active slides
        const activeSlides = (Array.isArray(data) ? data : []).filter(
          (slide: HeroSlide) => slide.active !== false
        )

        if (posterSlides.length > 0) {
          setSlides([campaignSlide, ...posterSlides])
          setCachedSlides(posterSlides)
        } else if (activeSlides.length > 0) {
          setSlides([campaignSlide, ...activeSlides])
          setCachedSlides(activeSlides)
        } else {
          setSlides([campaignSlide, ...fallbackImages])
        }
      } else if (posterSlides.length > 0) {
        setSlides([campaignSlide, ...posterSlides])
      }
    } catch (error) {
      console.error("Error fetching hero slides:", error)
      // Keep current slides (cached or fallback)
      if (slides.length === 0) {
        setSlides([campaignSlide, ...fallbackImages])
      }
    } finally {
      setIsLoading(false)
    }
  }, [slides])

  // Initial load with cache-first strategy
  useEffect(() => {
    const cachedData = getCachedSlides()

    if (cachedData) {
      setSlides([campaignSlide, ...cachedData])
      setIsLoading(false)

      // If cache is stale, refresh in background without showing loading
      if (!isCacheFresh()) {
        fetchSlides(false) // false = don't show loading spinner
      }
    } else {
      // No cache, fetch fresh data
      fetchSlides(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-rotate slides every 5 seconds (paused for reduced-motion users)
  useEffect(() => {
    if (slides.length <= 1 || prefersReduced) return

    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [slides.length, prefersReduced])

  const goToPrevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  const goToNextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  // Preload only the next slide. Data URIs are already in memory, and preloading
  // every slide previously pulled ~15MB of fallback art on first paint.
  useEffect(() => {
    if (slides.length <= 1) return
    const next = slides[(activeSlide + 1) % slides.length]
    if (next?.image && !next.image.startsWith("data:")) {
      const img = new window.Image()
      img.src = next.image
    }
  }, [slides, activeSlide])

  // A shrinking slide array can leave activeSlide out of range, which renders
  // the broken-image placeholder.
  useEffect(() => {
    setActiveSlide((prev) => (prev >= slides.length ? 0 : prev))
  }, [slides.length])

  // Memoize current slide
  const currentSlide = useMemo(() => slides[Math.min(activeSlide, slides.length - 1)], [slides, activeSlide])

  // Show minimal loading skeleton only if no cached data
  if (isLoading && slides.length === 0) {
    return (
      <section className="relative w-full">
        <div className="w-full">
          <div className="aspect-[16/7] w-full animate-pulse bg-gradient-to-br from-brand-primary/30 to-indigo-600/30 md:aspect-[16/5]" />
        </div>
      </section>
    )
  }

  if (slides.length === 0) {
    return null
  }

  return (
    <section
      className="relative w-full"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured promotions"
    >
      {/* Live region for screen reader slide announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {activeSlide + 1} of {slides.length}
        {currentSlide?.title ? `: ${currentSlide.title}` : ''}
      </div>

      <div className="w-full">
        {/* Edge-to-edge promotional banner carousel */}
        <div className="group relative aspect-[16/7] overflow-hidden bg-gray-100 shadow-sm md:aspect-[16/5]">
          <AnimatePresence initial={false}>
            <motion.div
              key={activeSlide}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link href={currentSlide?.link || '/products'} className="block h-full w-full">
                <img
                  src={currentSlide?.image || '/placeholder.svg'}
                  alt={currentSlide?.title || `Featured offer ${activeSlide + 1}`}
                  className="h-full w-full object-cover"
                  fetchPriority={activeSlide === 0 ? 'high' : 'auto'}
                  loading="eager"
                  decoding="async"
                  onError={(e) => { e.currentTarget.src = '/placeholder.svg' }}
                />

                {/* Featured item: the poster art carries the message, this
                    carries the thing being sold. */}
                {currentSlide?.feature && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center pr-4 md:flex lg:pr-10 xl:pr-16">
                    <div className="w-[268px] rounded-3xl bg-white/95 p-4 shadow-2xl ring-1 ring-black/10 backdrop-blur-sm lg:w-[320px] lg:p-5">
                      <div className="relative h-[132px] w-full lg:h-[168px]">
                        {isImageUrl(currentSlide.feature.image) ? (
                          <img
                            src={currentSlide.feature.image!}
                            alt=""
                            className="h-full w-full object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : currentSlide.feature.image ? (
                          <span className="flex h-full w-full items-center justify-center rounded-xl bg-brand-surface text-black">
                            <CategoryGlyph
                              label={currentSlide.feature.name || currentSlide.feature.image}
                              className="h-16 w-16 lg:h-20 lg:w-20"
                              strokeWidth={1.2}
                            />
                          </span>
                        ) : (
                          <div className="h-full w-full rounded-xl bg-brand-surface" />
                        )}

                        {currentSlide.feature.mrp != null &&
                          currentSlide.feature.price != null &&
                          Number(currentSlide.feature.mrp) > Number(currentSlide.feature.price) && (
                            <span className="themed-ribbon absolute left-0 top-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow">
                              {Math.round(
                                ((Number(currentSlide.feature.mrp) - Number(currentSlide.feature.price)) /
                                  Number(currentSlide.feature.mrp)) *
                                  100,
                              )}
                              % OFF
                            </span>
                          )}
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-brand-text-primary lg:text-base">
                        {currentSlide.feature.name}
                      </p>

                      {currentSlide.feature.price != null ? (
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-2xl font-extrabold leading-none text-brand-primary lg:text-3xl">
                            ₹{Number(currentSlide.feature.price).toLocaleString("en-IN")}
                          </span>
                          {currentSlide.feature.mrp != null &&
                            Number(currentSlide.feature.mrp) > Number(currentSlide.feature.price) && (
                              <span className="text-sm text-brand-text-tertiary line-through">
                                ₹{Number(currentSlide.feature.mrp).toLocaleString("en-IN")}
                              </span>
                            )}
                        </div>
                      ) : (
                        currentSlide.feature.caption && (
                          <p className="mt-2 text-sm text-brand-text-tertiary">
                            {currentSlide.feature.caption}
                          </p>
                        )
                      )}

                      <span className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-bold text-white shadow-lg">
                        {currentSlide.feature.type === "product" ? "Shop this" : "Shop now"}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                )}

                {/* Text overlay only when a slide supplies copy */}
                {(currentSlide?.title || currentSlide?.subtitle || currentSlide?.cta) && (
                  <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/65 via-black/25 to-transparent">
                    <div className="max-w-lg px-6 text-white sm:px-10 lg:px-16">
                      {currentSlide?.title && (
                        <h2 className="text-2xl font-black leading-tight drop-shadow sm:text-3xl lg:text-4xl">
                          {currentSlide.title}
                        </h2>
                      )}
                      {currentSlide?.subtitle && (
                        <p className="mt-2 line-clamp-2 text-sm text-white/90 drop-shadow sm:text-base">
                          {currentSlide.subtitle}
                        </p>
                      )}
                      <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-brand-primary shadow-lg transition-transform group-hover:scale-105">
                        {currentSlide?.cta || 'Shop Now'} <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                )}
              </Link>
            </motion.div>
          </AnimatePresence>

          {/* Arrows */}
          {slides.length > 1 && (
            <>
              <button
                onClick={goToPrevSlide}
                aria-label="Previous slide"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 opacity-0 shadow-md ring-1 ring-black/5 backdrop-blur transition-all hover:scale-105 hover:bg-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 group-hover:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={goToNextSlide}
                aria-label="Next slide"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-800 opacity-0 shadow-md ring-1 ring-black/5 backdrop-blur transition-all hover:scale-105 hover:bg-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 group-hover:opacity-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Dots */}
          {slides.length > 1 && (
            <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={activeSlide === index ? 'true' : undefined}
                  className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/20"
                >
                  <span
                    className="h-2 rounded-full shadow transition-all duration-300"
                    style={{
                      width: activeSlide === index ? 26 : 8,
                      backgroundColor: activeSlide === index ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
