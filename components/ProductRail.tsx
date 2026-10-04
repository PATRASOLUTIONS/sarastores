"use client"

import { useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import CategoryProductCard from "@/components/CategoryProductCard"
import type { Rail } from "@/utils/catalog"

export default function ProductRail({ rail }: { rail: Rail }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const scrollBy = (dir: number) => {
    scrollerRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" })
  }

  if (rail.products.length === 0) return null

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 md:px-6">
        <div>
          <h2 className="text-lg font-bold leading-tight text-gray-900 md:text-xl">{rail.title}</h2>
          <p className="text-xs text-gray-500">{rail.subtitle}</p>
        </div>
        <Link
          href={rail.href}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary transition-colors hover:text-brand-primary-hover"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="relative px-3 py-4 md:px-4">
        <button
          onClick={() => scrollBy(-1)}
          aria-label={`Scroll ${rail.title} left`}
          className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:flex"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>

        <div ref={scrollerRef} className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth px-1">
          {rail.products.map((p) => {
            const product = {
              ...p,
              id: p.id || p._id,
              name: p.name,
              price: p.price,
              image: p.image,
            }
            return (
              <div key={product.id} className="w-44 flex-shrink-0 sm:w-52 md:w-60">
                <CategoryProductCard product={product} />
              </div>
            )
          })}
        </div>

        <button
          onClick={() => scrollBy(1)}
          aria-label={`Scroll ${rail.title} right`}
          className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:flex"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </section>
  )
}
