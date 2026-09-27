"use client"

import Link from "next/link"

/** Brand tiles built from live stock counts. No logo assets exist, so this is typographic. */
export default function BrandStrip({ brands }: { brands: Array<{ name: string; count: number }> }) {
  if (brands.length === 0) return null

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 md:text-xl">Shop by brand</h2>
        <p className="text-xs text-gray-500">Authorised dealer — genuine products with full warranty</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {brands.map((brand) => (
          <Link
            key={brand.name}
            href={`/products?q=${encodeURIComponent(brand.name)}`}
            className="group flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50 px-3 py-5 transition-all hover:border-brand-primary/40 hover:bg-white hover:shadow-md"
          >
            <span className="text-base font-extrabold uppercase tracking-wide text-gray-800 transition-colors group-hover:text-brand-primary">
              {brand.name}
            </span>
            <span className="mt-0.5 text-[11px] text-gray-400">{brand.count} products</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
