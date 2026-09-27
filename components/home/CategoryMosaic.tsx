"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { CategoryTile } from "@/utils/catalog"

/** Shop-by-category tiles. Uniform grid — the catalogue has too few categories
 *  for a lead/feature layout without leaving an empty cell. */
export default function CategoryMosaic({ tiles }: { tiles: CategoryTile[] }) {
  if (tiles.length === 0) return null

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold leading-tight text-gray-900 md:text-xl">Shop by category</h2>
          <p className="mt-0.5 text-xs text-gray-500">Everything for your home, in one place</p>
        </div>
        <Link
          href="/products"
          className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-semibold text-brand-primary hover:text-brand-primary-hover"
        >
          Browse all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.slice(0, 4).map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group overflow-hidden rounded-xl border border-gray-100 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-lg"
          >
            <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4">
              <img
                src={tile.image}
                alt={tile.label}
                loading="lazy"
                className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = "/placeholder.svg"
                }}
              />
            </div>
            <div className="border-t border-gray-100 px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover:text-brand-primary">
                {tile.label}
              </p>
              <p className="text-[11px] text-gray-500">{tile.count} products</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
