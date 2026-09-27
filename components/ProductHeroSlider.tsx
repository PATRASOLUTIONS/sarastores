"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, ShoppingBag, ArrowRight } from "lucide-react"
import Link from "next/link"

interface ProductAdvertisement {
  _id: string
  title: string
  subtitle?: string
  description?: string
  image: string
  ctaText?: string
  ctaLink?: string
  backgroundColor?: string
  textColor?: string
  overlayOpacity?: number
  isActive: boolean
  order: number
}

export default function ProductHeroSlider() {
  const [advertisements, setAdvertisements] = useState<ProductAdvertisement[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    fetchAdvertisements()
  }, [])

  // Auto-play functionality
  useEffect(() => {
    if (advertisements.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % advertisements.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(interval)
  }, [advertisements.length, isPaused])

  const fetchAdvertisements = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/product-advertisements")

      if (!response.ok) {
        throw new Error("Failed to fetch advertisements")
      }

      const data = await response.json()
      // Filter active advertisements and sort by order
      const activeAds = data
        .filter((ad: ProductAdvertisement) => ad.isActive)
        .sort((a: ProductAdvertisement, b: ProductAdvertisement) => a.order - b.order)

      setAdvertisements(activeAds)
    } catch (err) {
      console.error("Error fetching advertisements:", err)
      setError(err instanceof Error ? err.message : "Failed to load advertisements")
    } finally {
      setIsLoading(false)
    }
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + advertisements.length) % advertisements.length)
  }

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % advertisements.length)
  }

  const handleMouseEnter = () => {
    setIsPaused(true)
  }

  const handleMouseLeave = () => {
    setIsPaused(false)
  }

  // Don't render if loading or no advertisements
  if (isLoading) {
    return (
      <div className="w-full h-96 bg-gray-200 animate-pulse flex items-center justify-center">
        <div className="text-gray-500">Loading advertisements...</div>
      </div>
    )
  }

  if (error || advertisements.length === 0) {
    return (
      <div className="w-full h-96 bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-center text-white">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-3xl font-bold mb-2">Welcome to Our Store</h2>
          <p className="text-blue-100 mb-6">Discover amazing products at great prices</p>
          <Link href="/products">
            <button className="bg-white text-blue-800 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors inline-flex items-center">
              Shop Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </Link>
        </div>
      </div>
    )
  }

  const currentAd = advertisements[currentSlide]

  return (
    <div
      className="relative w-full h-96 overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Slides Container */}
      <div
        className="flex transition-transform duration-700 ease-in-out h-full"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {advertisements.map((ad, index) => (
          <div
            key={ad._id}
            className="w-full h-[400px] flex-shrink-0 relative"
            style={{ backgroundColor: ad.backgroundColor || "#1e40af" }}
          >
            {/* Background Image */}
            {ad.image && (
              <div className="absolute inset-0">
                <img src={ad.image || "/placeholder.svg"} alt={ad.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black" style={{ opacity: (ad.overlayOpacity || 50) / 100 }} />
              </div>
            )}

            {/* Content */}
            <div className="relative z-10 h-full flex items-center">
              <div className="container mx-auto px-4">
                <div className="max-w-3xl">
                  {/* Subtitle */}
                  {ad.subtitle && (
                    <p
                      className="text-sm md:text-base font-medium mb-2 opacity-90"
                      style={{ color: ad.textColor || "#ffffff" }}
                    >
                      {ad.subtitle}
                    </p>
                  )}

                  {/* Title */}
                  <h1
                    className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
                    style={{ color: ad.textColor || "#ffffff" }}
                  >
                    {ad.title}
                  </h1>

                  {/* Description */}
                  {ad.description && (
                    <p
                      className="text-lg md:text-xl mb-8 opacity-90 max-w-2xl"
                      style={{ color: ad.textColor || "#ffffff" }}
                    >
                      {ad.description}
                    </p>
                  )}

                  {/* CTA Button */}
                  {ad.ctaText && ad.ctaLink && (
                    <Link href={ad.ctaLink}>
                      <button className="bg-white text-gray-900 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 inline-flex items-center shadow-lg">
                        {ad.ctaText}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {advertisements.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-3 rounded-full transition-all duration-300 backdrop-blur-sm"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-3 rounded-full transition-all duration-300 backdrop-blur-sm"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {advertisements.length > 1 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-3">
          {advertisements.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentSlide ? "bg-white scale-125" : "bg-white bg-opacity-50 hover:bg-opacity-75"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Slide Counter */}
      {advertisements.length > 1 && (
        <div className="absolute top-6 right-6 bg-black bg-opacity-30 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
          {currentSlide + 1} / {advertisements.length}
        </div>
      )}

      {/* Progress Bar */}
      {advertisements.length > 1 && !isPaused && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white bg-opacity-20">
          <div
            className="h-full bg-white transition-all duration-100 ease-linear"
            style={{
              width: `${((currentSlide + 1) / advertisements.length) * 100}%`,
              animation: `slideProgress 5s linear infinite`,
            }}
          />
        </div>
      )}

      {/* Custom CSS for progress animation */}
      <style jsx>{`
        @keyframes slideProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
