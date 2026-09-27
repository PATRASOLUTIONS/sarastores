"use client"

import { useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Lock, ArrowRight } from "lucide-react"
import CategoryProductCard from "@/components/CategoryProductCard"

/**
 * "Members-only prices" rail. Same catalogue, framed as a member benefit so the
 * value of signing in / joining Rewards is felt at the point of browsing, not
 * buried on a separate page.
 */
export default function MemberDeals({ products }: { products: any[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const scrollBy = (dir: number) => scrollerRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" })

  if (!Array.isArray(products) || products.length < 4) return null

  return (
    <section aria-labelledby="member-deals-heading" className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h2 id="member-deals-heading" className="text-lg font-bold leading-tight text-gray-900 md:text-xl">
              Members-only prices
            </h2>
            <p className="text-xs text-gray-500">Sign in to save your favourites and check out faster</p>
          </div>
        </div>
        <Link
          href="/register"
          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-600"
        >
          Unlock prices <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="relative px-3 py-4 md:px-4">
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll member deals left"
          className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:flex"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>

        <div ref={scrollerRef} className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth px-1">
          {products.map((p) => (
            <div key={p.id || p._id} className="w-44 flex-shrink-0 sm:w-52 md:w-60">
              <CategoryProductCard product={p} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll member deals right"
          className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:flex"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </section>
  )
}
