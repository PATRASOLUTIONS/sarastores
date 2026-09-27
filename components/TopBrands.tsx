"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"

interface BrandTile {
  name: string
  logo: string
  query: string
}

const BRANDS: BrandTile[] = [
  { name: "Samsung", logo: "/samsung.png", query: "samsung" },
  { name: "LG", logo: "/lg.png", query: "lg" },
  { name: "OPPO", logo: "/oppo.png", query: "oppo" },
  { name: "Realme", logo: "/realme.png", query: "realme" },
]

export default function TopBrands() {
  return (
    <section className="py-2" aria-label="Shop by brand">
      <div className="flex items-end justify-between mb-5 md:mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-primary mb-1">Trusted by thousands</p>
          <h2 className="heading-2">Top Brands</h2>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
        {BRANDS.map((brand, index) => (
          <motion.div
            key={brand.name}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: 0.04 * index, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={`/products?brand=${brand.query}`}
              className="group flex h-20 md:h-24 items-center justify-center rounded-2xl border border-brand-border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-[0_12px_28px_-12px_rgba(42,127,255,0.4)]"
              aria-label={`Shop ${brand.name} products`}
            >
              <Image
                src={brand.logo}
                alt={brand.name}
                width={120}
                height={56}
                className="max-h-10 md:max-h-12 w-auto object-contain opacity-80 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
                quality={75}
              />
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
