"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"

interface Category {
  id: string
  name: string
  icon?: string
  image?: string
  isEnabled?: boolean
}

export default function BrandMarquee() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories")
        if (response.ok) {
          const data = await response.json()
          // Filter only enabled categories (isEnabled !== false)
          const enabledCategories = data.filter((cat: Category) => cat.isEnabled !== false)
          setCategories(enabledCategories)
        }
      } catch (error) {
        console.error("Error fetching categories:", error)
      }
    }
    fetchCategories()
  }, [])

  // Duplicate the base categories multiple times to ensure the marquee
  // has enough repeated content for a smooth, gap-free loop.
  const REPEAT = 3
  const duplicatedCategories = Array.from({ length: REPEAT }).flatMap(() => categories)
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!trackRef.current) return
    const el = trackRef.current

    const updateDuration = () => {
      try {
        // track contains duplicated items repeated REPEAT times,
        // so distance to scroll for one full base-set = scrollWidth / REPEAT
        const distance = el.scrollWidth / REPEAT || el.scrollWidth
        const speed = 60 // px per second
        const duration = Math.max(12, distance / speed)
        el.style.setProperty('--marquee-duration', `${duration}s`)
        // set translation % so keyframes can translate by exactly one base-set
        el.style.setProperty('--marquee-translate', `-${100 / REPEAT}%`)
      } catch (e) {
        // ignore
      }
    }

    updateDuration()
    // Recompute when window resizes
    window.addEventListener('resize', updateDuration)

    // Recompute when images inside the track finish loading (avoids measuring before images load)
    const imgs: HTMLImageElement[] = Array.from(el.querySelectorAll('img'))
    const onImgLoad = () => {
      // small delay to allow layout to settle
      requestAnimationFrame(() => setTimeout(updateDuration, 20))
    }
    imgs.forEach(img => {
      if (img.complete) return
      img.addEventListener('load', onImgLoad)
      img.addEventListener('error', onImgLoad)
    })

    // If DOM changes (e.g., categories update), re-measure
    const mo = new MutationObserver(() => {
      requestAnimationFrame(() => setTimeout(updateDuration, 20))
    })
    mo.observe(el, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', updateDuration)
      imgs.forEach(img => {
        img.removeEventListener('load', onImgLoad)
        img.removeEventListener('error', onImgLoad)
      })
      mo.disconnect()
    }
  }, [categories])

  if (categories.length === 0) return null

  return (
    <div className="bg-brand-surface border-y border-brand-border py-2 md:py-3 overflow-hidden" aria-label="Browse categories" role="region">
      <div className="relative">
        {/* Pause/play toggle for accessibility */}
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm text-gray-500 hover:text-brand-primary transition-colors"
          aria-label={isPaused ? 'Play category scroll' : 'Pause category scroll'}
        >
          {isPaused ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          )}
        </button>
        {/* Wrap both tracks so hovering the container pauses both tracks */}
        <div className={`relative flex marquee-container ${isPaused ? 'marquee-paused' : ''}`}>
          {/* Single track with duplicated items for a seamless loop */}
          <div ref={trackRef} className="flex marquee-track gap-4 md:gap-8 items-center">
            {duplicatedCategories.map((category, index) => (
              <Link
                key={`${category.id}-${index}`}
                href={`/category/${category.name.replace(/\s+/g, '-')}`}
                className="marquee-item flex-shrink-0 flex items-center gap-2 px-3 py-1 md:px-4 md:py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 group"
              >
                {category.image && (
                  category.image.startsWith("http") ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      loading="lazy"
                      className="w-5 h-5 md:w-6 md:h-6 object-contain transition-transform group-hover:scale-110"
                    />
                  ) : (
                    <span className="text-xl md:text-2xl transition-transform group-hover:scale-110">{category.image}</span>
                  )
                )}
                <span className="text-xs md:text-sm font-medium text-gray-700 group-hover:text-brand-primary whitespace-nowrap">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        :root { --marquee-duration: 28s; }
        @keyframes marquee {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-50%,0,0); }
        }
        .marquee-container:hover .marquee-track,
        .marquee-paused .marquee-track {
          animation-play-state: paused;
        }
        .marquee-track {
          display: flex;
          align-items: center;
          gap: 1rem;
          animation: marquee var(--marquee-duration) linear infinite;
          animation-timing-function: linear;
          will-change: transform;
          min-width: max-content;
          white-space: nowrap;
          transform: translate3d(0,0,0);
          backface-visibility: hidden;
        }
        .marquee-track.second {
          /* kept for backwards compatibility; not used currently */
        }
        .marquee-item {
          min-width: 110px;
        }
        /* Use CSS variable to control how far the track translates */
        @keyframes marquee-var {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(var(--marquee-translate, -50%),0,0); }
        }
        .marquee-track {
          animation-name: marquee-var;
        }
        /* pause handled via container hover to keep both tracks synced */
      `}</style>
    </div>
  )
}


