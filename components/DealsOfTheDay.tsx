"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Zap, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import { fetchWithCache } from "@/utils/cache"
import { selectDeals, getTimeLeft } from "@/utils/deals"
import CategoryProductCard from "@/components/CategoryProductCard"

const DATA_TTL = 5 * 60 * 1000


function TimeCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[2.25rem] text-center bg-gray-900 text-white text-sm md:text-base font-bold tabular-nums px-2 py-1 rounded-md">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">{label}</span>
    </div>
  )
}

export default function DealsOfTheDay() {
  const [products, setProducts] = useState<any[]>([])
  const [timeLeft, setTimeLeft] = useState(getTimeLeft())
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    // Same key and projection as the homepage rails, so this reuses that payload
    // instead of pulling the full 1.7 MB catalogue a second time.
    fetchWithCache(
      "products-card",
      async () => {
        const r = await fetch("/api/products?fields=card")
        if (!r.ok) throw new Error("Failed to fetch products")
        return r.json()
      },
      DATA_TTL,
    )
      .then((data: any[]) => {
        if (cancelled || !Array.isArray(data)) return
        setProducts(data)
      })
      .catch(() => { })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(getTimeLeft()), 1000)
    return () => clearInterval(t)
  }, [])

  const deals = useMemo(() => selectDeals(products), [products])

  if (deals.length === 0) return null

  const scrollBy = (dir: number) => {
    scrollerRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" })
  }

  return (
    <section className="scroll-mt-28 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-accent/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-accent text-white flex items-center justify-center shadow-sm shadow-brand-accent/30">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 leading-tight">Deals of the Day</h2>
            <p className="text-xs text-gray-500">Lowest prices, today only</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 mr-1 hidden sm:inline">Ends in</span>
            <TimeCell value={timeLeft.hours} label="Hrs" />
            <span className="text-gray-900 font-bold pb-4">:</span>
            <TimeCell value={timeLeft.minutes} label="Min" />
            <span className="text-gray-900 font-bold pb-4">:</span>
            <TimeCell value={timeLeft.seconds} label="Sec" />
          </div>
          <Link
            href="/products"
            className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Scroller */}
      <div className="relative px-2 md:px-4 py-4">
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>

        <div ref={scrollerRef} className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-1">
          {deals.map((p) => (
            <div key={p.id || p._id} className="w-44 sm:w-52 md:w-60 flex-shrink-0">
              <CategoryProductCard product={p} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </section>
  )
}
