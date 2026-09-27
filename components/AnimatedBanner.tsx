"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface AnimatedBannerProps {
  isLoading?: boolean
}

interface BannerData {
  id: string
  title: string
  subtitle: string
  description: string
  buttonText: string
  buttonLink: string
  image?: string
}

const defaultBanner: BannerData = {
  id: "default",
  title: "Special Offers Just For You",
  subtitle: "Limited Time Deals",
  description:
    "Discover amazing discounts on our premium products. Take advantage of these exclusive offers before they're gone!",
  buttonText: "Shop Now",
  buttonLink: "/products",
  image: "/placeholder.svg?height=600&width=600",
}

export default function AnimatedBanner({ isLoading = false }: AnimatedBannerProps) {
  const [banner, setBanner] = useState<BannerData>(defaultBanner)
  const [loading, setLoading] = useState(isLoading)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const fetchBanner = async () => {
      try {
        const response = await fetch("/api/animated-banner")
        if (!response.ok) {
          console.error("Failed to fetch banner, using default")
          setBanner(defaultBanner)
        } else {
          const data = await response.json()
          if (data && Object.keys(data).length > 0) {
            setBanner(data)
          } else {
            setBanner(defaultBanner)
          }
        }
      } catch (error) {
        console.error("Error fetching animated banner:", error)
        setBanner(defaultBanner)
      } finally {
        setLoading(false)
      }
    }

    fetchBanner()

    // Intersection observer for animation
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    const element = document.getElementById("animated-banner")
    if (element) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [])

  if (loading) {
    return (
      <div className="w-full py-16 px-4">
        <div className="container mx-auto">
          <div className="h-64 bg-gray-200 animate-pulse rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <section
      id="animated-banner"
      className={`w-full py-16 px-4 transition-opacity duration-1000 ${isVisible ? "opacity-100" : "opacity-0"}`}
      style={{ backgroundColor: "#003087" }}
    >
      <div className="container mx-auto relative overflow-hidden rounded-xl">
        {/* Animated elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600 rounded-full opacity-20 animate-float-slow"></div>
          <div className="absolute top-40 -right-20 w-80 h-80 bg-blue-500 rounded-full opacity-10 animate-float-medium"></div>
          <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-400 rounded-full opacity-10 animate-float-fast"></div>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center">
          <div className="md:w-2/3 p-8 md:p-12">
            <span className="inline-block px-4 py-1 bg-blue-700 text-white text-sm font-semibold rounded-full mb-4">
              {banner.subtitle}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{banner.title}</h2>
            <p className="text-blue-100 mb-8 max-w-lg">{banner.description}</p>
            <Link href={banner.buttonLink}>
              <button className="group bg-white text-blue-800 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center">
                {banner.buttonText}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
          </div>
          <div className="md:w-1/3 p-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/30 to-transparent rounded-lg"></div>
              <img
                src={banner.image || "/placeholder.svg?height=400&width=400&query=special+offers"}
                alt="Special Offers"
                className="rounded-lg shadow-xl w-full h-auto"
              />

              {/* Floating elements for visual interest */}
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-lg opacity-80 rotate-12 animate-float-slow"></div>
              <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-blue-300 rounded-full opacity-80 animate-float-medium"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
