"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import Loader from "@/components/Loader"

interface Category {
  id: string
  name: string
  image: string
  count?: number
  description?: string
  isEnabled?: boolean
}

export default function CategorySection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState(6)

  // Responsive item count
  useEffect(() => {
    const updateItemsPerPage = () => {
      if (window.innerWidth < 640) setItemsPerPage(1)
      else if (window.innerWidth < 1024) setItemsPerPage(2)
      else setItemsPerPage(6)
    }

    updateItemsPerPage()
    window.addEventListener("resize", updateItemsPerPage)
    return () => window.removeEventListener("resize", updateItemsPerPage)
  }, [])

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true)
      try {
        const [categoriesResponse, productsResponse] = await Promise.all([
          fetch("/api/categories"),
          // Only `category` is read below, so the card projection is plenty.
          fetch("/api/products?fields=card"),
        ])

        if (!categoriesResponse.ok) {
          throw new Error("Failed to fetch categories")
        }

        const categoriesData = await categoriesResponse.json()
        const productsData = productsResponse.ok ? await productsResponse.json() : []

        const categoriesWithCounts = categoriesData
          .filter((cat: Category) => cat.isEnabled !== false) // Filter only enabled categories
          .map((cat: Category) => ({
            ...cat,
            count: productsData.filter((p: any) => p.category === cat.id).length,
          }))
          .filter((cat: Category) => (cat.count || 0) > 0)

        if (categoriesWithCounts.length === 0) {
          setError("No categories with products found")
        } else {
          setCategories(categoriesWithCounts)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategories()
  }, [])

  // Auto slide
  useEffect(() => {
    if (!isPaused && categories.length > itemsPerPage) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) =>
          prev < categories.length - itemsPerPage ? prev + 1 : 0
        )
      }, 5000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPaused, categories.length, itemsPerPage])

  const prevSlide = () => {
    setCurrentIndex((prev) =>
      prev > 0 ? prev - 1 : categories.length - itemsPerPage
    )
  }

  const nextSlide = () => {
    setCurrentIndex((prev) =>
      prev < categories.length - itemsPerPage ? prev + 1 : 0
    )
  }

  return (
    <section className="py-10 bg-white">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Shop by Category</h2>
          <p className="text-slate-600 mt-1">Explore our collections</p>
        </div>

        {/* Loader */}
        {isLoading && (
          <Loader variant="brand" size="lg" text="Loading categories..." />
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {/* No categories */}
        {!isLoading && !error && categories.length === 0 && (
          <p className="text-center text-slate-500">No categories found.</p>
        )}

        {/* Carousel */}
        {!isLoading && !error && categories.length > 0 && (
          <div className="relative">

            {/* Slider wrapper (centered) */}
            <div className="overflow-hidden rounded-xl">
              <div className="flex justify-center">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{
                    transform: `translateX(-${currentIndex * (100 / itemsPerPage)}%)`,
                  }}
                >
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/category/${category.name.replace(/\s+/g, "-")}`}
                      className="min-w-full sm:min-w-1/2 md:min-w-1/3 lg:min-w-[16.66%] px-2 flex-shrink-0"
                    >
                      <div className="group relative h-40 bg-white rounded-xl overflow-hidden shadow hover:shadow-lg border border-slate-200 transition-all">
                        <img
                          src={category.image || "/placeholder.svg"}
                          alt={category.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3">
                          <h3 className="text-base font-semibold text-white">{category.name}</h3>
                          <p className="text-xs text-white/80">{category.count} items</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Controls */}
            {categories.length > itemsPerPage && (
              <div className="flex flex-col items-center gap-4 mt-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={prevSlide}
                    className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 shadow border"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => setIsPaused((v) => !v)}
                    className="p-2 rounded-full bg-slate-900 text-white hover:bg-slate-800"
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={nextSlide}
                    className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 shadow border"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Dots */}
                <div className="flex gap-2">
                  {Array.from({
                    length: Math.max(1, categories.length - itemsPerPage + 1),
                  }).map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`h-2 rounded-full cursor-pointer transition-all ${currentIndex === i ? "bg-slate-900 w-6" : "bg-slate-300 w-2"
                        }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
