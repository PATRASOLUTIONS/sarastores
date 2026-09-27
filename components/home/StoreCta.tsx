"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MapPin, Store, Headphones, ArrowRight } from "lucide-react"

/** Physical-store presence is Sara's clearest advantage over online-only sellers. */
export default function StoreCta() {
  const [storeCount, setStoreCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.success && Array.isArray(d.stores)) setStoreCount(d.stores.length)
      })
      .catch(() => {
        /* count is decorative */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary-subtle px-3 py-1 text-xs font-semibold text-brand-primary">
            <Store className="h-3.5 w-3.5" />
            {storeCount ? `${storeCount} stores across Karnataka` : "Stores across Karnataka"}
          </span>
          <h2 className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">
            Buy online, or see it in person first
          </h2>
          <p className="mt-2 max-w-lg text-sm text-gray-600">
            Touch and compare before you buy. Our staff help you pick the right size, capacity and
            budget — then deliver and install it at your home.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/store-locator"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
            >
              <MapPin className="h-4 w-4" />
              Find your nearest store
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Headphones className="h-4 w-4" />
              Talk to us
            </Link>
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-3 self-center">
          {[
            ["Free delivery", "On every order"],
            ["Genuine stock", "Authorised dealer"],
            ["Easy EMI", "On major cards"],
            ["Installation", "Handled for you"],
          ].map(([title, sub]) => (
            <li key={title} className="rounded-xl bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="text-[11px] text-gray-500">{sub}</p>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/store-locator"
        className="flex items-center justify-center gap-1 border-t border-gray-100 bg-gray-50 py-2.5 text-xs font-semibold text-brand-primary hover:bg-gray-100 md:hidden"
      >
        View all stores <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  )
}
