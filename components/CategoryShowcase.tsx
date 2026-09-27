"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

interface ShowcaseTile {
  label: string
  caption: string
  searchTerm: string
  image: string
  gradient: string
  /** Tailwind text color for the accent */
  accent: string
  /** spans 2 columns on large screens for the hero tile */
  wide?: boolean
}

const TILES: ShowcaseTile[] = [
  {
    label: "Televisions",
    caption: "4K · QLED · OLED",
    searchTerm: "TV",
    image: "/products/tv.png",
    gradient: "from-slate-900 via-slate-800 to-slate-900",
    accent: "text-blue-300",
    wide: true,
  },
  {
    label: "Refrigerators",
    caption: "Frost-free & side-by-side",
    searchTerm: "REFRIGERATOR",
    image: "/products/sidebyside.png",
    gradient: "from-blue-700 to-blue-500",
    accent: "text-blue-100",
  },
  {
    label: "Washing Machines",
    caption: "Front & top load",
    searchTerm: "WASHING MACHINE",
    image: "/products/washer.png",
    gradient: "from-cyan-700 to-cyan-500",
    accent: "text-cyan-100",
  },
  {
    label: "Air Conditioners",
    caption: "Inverter · 5-star",
    searchTerm: "AIR CONDITIONERS",
    image: "/products/ac.png",
    gradient: "from-sky-700 to-sky-500",
    accent: "text-sky-100",
  },
  // {
  //   label: "Smartphones",
  //   caption: "Latest 5G phones",
  //   searchTerm: "MOBILE",
  //   image: "/products/iphone.png",
  //   gradient: "from-indigo-800 to-indigo-600",
  //   accent: "text-indigo-100",
  // },
  {
    label: "Dishwashers",
    caption: "Effortless clean",
    searchTerm: "DISHWASHER",
    image: "/products/dishwasher.png",
    gradient: "from-teal-700 to-emerald-600",
    accent: "text-emerald-100",
  },
]

export default function CategoryShowcase() {
  return (
    <section className="py-2" aria-label="Shop by category">
      <div className="flex items-end justify-between mb-5 md:mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-primary mb-1">Explore the store</p>
          <h2 className="heading-2">Shop by Category</h2>
        </div>
        <Link
          href="/products"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:text-brand-primary-hover transition-colors group"
        >
          View all
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[150px] md:auto-rows-[190px]">
        {TILES.map((tile, index) => (
          <motion.div
            key={tile.label}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.05 * index, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={tile.wide ? "col-span-2 lg:row-span-2" : ""}
          >
            <Link
              href={`/products?subCategory=${encodeURIComponent(tile.searchTerm)}`}
              className={`group relative block h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br ${tile.gradient} ring-1 ring-black/5 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.25)] hover:shadow-[0_18px_40px_-12px_rgba(15,23,42,0.45)] transition-all duration-400`}
            >
              {/* Decorative glow */}
              <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

              {/* Product image */}
              <div className={`absolute ${tile.wide ? "bottom-0 right-0 h-[78%] w-[60%]" : "bottom-0 right-0 h-[70%] w-[62%]"} flex items-end justify-end p-3`}>
                <Image
                  src={tile.image}
                  alt={tile.label}
                  width={tile.wide ? 360 : 220}
                  height={tile.wide ? 360 : 220}
                  className="h-full w-full object-contain drop-shadow-2xl group-hover:scale-[1.06] transition-transform duration-500 ease-out"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  quality={75}
                />
              </div>

              {/* Text content */}
              <div className="relative z-10 flex h-full flex-col justify-between p-4 md:p-5">
                <div className="max-w-[60%]">
                  <h3 className={`font-heading font-bold text-white leading-tight ${tile.wide ? "text-2xl md:text-3xl" : "text-base md:text-lg"}`}>
                    {tile.label}
                  </h3>
                  <p className={`mt-1 text-xs md:text-sm ${tile.accent}`}>{tile.caption}</p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 text-xs md:text-sm font-semibold text-white/90 group-hover:gap-2.5 transition-all">
                  Shop now
                  <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
