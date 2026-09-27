"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { AirVent, Fan, type LucideIcon } from "lucide-react"

// Served from public/ on purpose: these used to hotlink a competitor's image
// CDN, which broke as soon as the open-proxy wildcard was removed from
// next.config.mjs and left us dependent on a rival's uptime.
const STATIC_CATEGORIES: {
  label: string
  searchTerm: string
  /** Falls back to `icon` until real artwork exists for the category. */
  image?: string
  icon?: LucideIcon
  hidden?: boolean
  subCategories?: string[]
}[] = [
    {
      label: "Dishwasher",
      searchTerm: "DISHWASHER",
      image: "/products/dishwasher.png",
    },
    {
      label: "Refrigerator",
      searchTerm: "REFRIGERATOR",
      image: "/products/fridge.png",
    },
    {
      label: "Washing machine",
      searchTerm: "WASHING MACHINE",
      image: "/products/washer.png",
    },
    {
      label: "Tv",
      searchTerm: "TV",
      image: "/products/tv.png",
    },
    {
      label: "Air conditioners",
      searchTerm: "AIR CONDITIONERS",
      image: "/products/ac.png",
    },
    {
      label: "Built in",
      searchTerm: "Built In",
      icon: AirVent,
    },
    {
      label: "Freezer",
      searchTerm: "Freezer",
      image: "/products/sidebyside.png",
    },
    {
      label: "Air cooler",
      searchTerm: "AIR COOLER",
      icon: Fan,
    },
  ]

export default function CategoryCircles() {
  const visibleItems = STATIC_CATEGORIES.filter((item) => !item.hidden)

  return (
    <section
      className="relative bg-white border-b border-brand-border/70 py-2 md:py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      aria-label="Shop by category"
    >
      <div className="section-container">
        <div className="flex items-start justify-start lg:justify-center gap-5 sm:gap-7 md:gap-9 lg:gap-11 xl:gap-14 overflow-x-auto scrollbar-hide pb-1">
          {visibleItems.map((item, index) => {
            const base = `/products?subCategory=${encodeURIComponent(item.searchTerm)}`
            const href = item.subCategories && item.subCategories.length > 0
              ? `${base}&subCategories=${encodeURIComponent(item.subCategories.join(","))}`
              : base

            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.04 * index,
                  duration: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex-shrink-0"
              >
                <Link
                  href={href}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  {/* Circle with gradient ring on hover */}
                  <div className="relative">
                    <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative w-[56px] h-[56px] md:w-[62px] md:h-[62px] lg:w-[66px] lg:h-[66px] rounded-full border border-brand-border group-hover:border-transparent bg-white group-hover:shadow-[0_8px_20px_-6px_rgba(15,37,87,0.35)] transition-all duration-300 flex items-center justify-center overflow-hidden p-1.5">
                      <div className="w-full h-full rounded-full overflow-hidden bg-brand-surface flex items-center justify-center">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.label}
                            width={76}
                            height={76}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                            sizes="76px"
                            quality={75}
                          />
                        ) : item.icon ? (
                          <item.icon
                            className="w-7 h-7 text-brand-primary group-hover:scale-110 transition-transform duration-500 ease-out"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Label */}
                  <span className="text-[11px] md:text-xs font-semibold text-brand-text-secondary group-hover:text-brand-primary transition-colors duration-200 text-center leading-tight max-w-[88px]">
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
