"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import CategoryGlyph from "@/components/CategoryGlyph"

interface SubCategory {
  id: string
  name: string
  image?: string
  active?: boolean
}

export default function SubCategoriesMarquee() {
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])

  useEffect(() => {
    const fetchSubCategories = async () => {
      try {
        const response = await fetch("/api/sub-categories")
        if (response.ok) {
          const data = await response.json()
          setSubCategories(data.filter((sub: SubCategory) => sub.active !== false))
        }
      } catch (error) {
        console.error("Error fetching sub-categories:", error)
      }
    }
    fetchSubCategories()
  }, [])

  if (subCategories.length === 0) return null

  // Triple for seamless loop
  const marqueeItems = [...subCategories, ...subCategories, ...subCategories]

  return (
    <div className="bg-gradient-to-r from-brand-primary-subtle via-white to-brand-primary-subtle border-y border-brand-border py-3 md:py-4 overflow-hidden" aria-label="Browse sub-categories" role="region">
      <div className="marquee-wrapper">
        <div className="marquee-track">
          {marqueeItems.map((subCategory, index) => (
            <Link
              key={`${subCategory.id}-${index}`}
              href={`/sub-category/${subCategory.name.replace(/\s+/g, "-")}`}
              className="flex-shrink-0 flex flex-col items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all group cursor-pointer border border-brand-border"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-brand-primary-light to-blue-50 flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform">
                {subCategory.image &&
                (subCategory.image.startsWith("http") ||
                  subCategory.image.startsWith("data:") ||
                  subCategory.image.startsWith("/")) ? (
                  <img
                    src={subCategory.image}
                    alt={subCategory.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <CategoryGlyph label={subCategory.name} className="h-6 w-6 md:h-7 md:w-7 text-black" />
                )}
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-800 group-hover:text-brand-primary whitespace-nowrap text-center">
                {subCategory.name}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .marquee-wrapper {
          width: 100%;
          overflow: hidden;
        }

        .marquee-track {
          display: flex;
          gap: 1.5rem;
          width: max-content;
          animation: marquee 40s linear infinite;
        }

        .marquee-wrapper:hover .marquee-track {
          animation-play-state: paused;
        }

        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
