"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface Advertisement {
  id: string
  title: string
  description: string
  image: string
  buttonText: string
  buttonLink: string
  bgColor: string
  textColor: string
  active: boolean
  featured: boolean
  order: number
}

const defaultAdvertisements: Advertisement[] = [
  {
    id: "ad1",
    title: "New iPhone 15 Pro",
    description: "Experience the latest technology with our newest smartphone collection",
    image: "https://placehold.co/600x400/003087/FFFFFF?text=iPhone+15+Pro",
    buttonText: "Shop Now",
    buttonLink: "/products/iphone-15-pro",
    bgColor: "from-blue-900 to-blue-800",
    textColor: "text-white",
    active: true,
    featured: true,
    order: 1,
  },
  {
    id: "ad2",
    title: "Gaming Laptops",
    description: "Powerful gaming laptops for the ultimate gaming experience",
    image: "https://placehold.co/600x400/333333/FFFFFF?text=Gaming+Laptop",
    buttonText: "Explore",
    buttonLink: "/products/gaming-laptops",
    bgColor: "from-gray-900 to-gray-800",
    textColor: "text-white",
    active: true,
    featured: false,
    order: 2,
  },
]

export default function ProductAdvertisements() {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAdvertisements = async () => {
      try {
        if (process.env.NODE_ENV === "development") console.log("Fetching advertisements...")
        const response = await fetch("/api/advertisements")

        if (!response.ok) {
          throw new Error(`Failed to fetch advertisements: ${response.status}`)
        }

        const data = await response.json()
        if (process.env.NODE_ENV === "development") console.log("Advertisements fetched:", data)

        if (Array.isArray(data) && data.length > 0) {
          // Filter active advertisements and sort by order
          const activeAds = data.filter((ad) => ad.active).sort((a, b) => (a.order || 0) - (b.order || 0))
          setAdvertisements(activeAds)
          // Store in localStorage as backup
          localStorage.setItem("advertisements", JSON.stringify(activeAds))
        } else {
          if (process.env.NODE_ENV === "development") console.log("No advertisements found in API response, using default advertisements")
          // Try localStorage fallback
          const storedAds = localStorage.getItem("advertisements")
          if (storedAds) {
            try {
              const parsed = JSON.parse(storedAds)
              setAdvertisements(parsed)
            } catch (e) {
              console.error("Error parsing stored advertisements:", e)
              setAdvertisements(defaultAdvertisements)
            }
          } else {
            setAdvertisements(defaultAdvertisements)
          }
        }
      } catch (err) {
        console.error("Error fetching advertisements:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")

        // Try localStorage fallback
        try {
          const storedAds = localStorage.getItem("advertisements")
          if (storedAds) {
            const parsed = JSON.parse(storedAds)
            setAdvertisements(parsed)
            setError(null) // Clear error if localStorage has data
          } else {
            setAdvertisements(defaultAdvertisements)
          }
        } catch (localErr) {
          console.error("Error loading from localStorage:", localErr)
          setAdvertisements(defaultAdvertisements)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchAdvertisements()
  }, [])

  if (isLoading) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Featured Products</h2>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
          </div>
        </div>
      </section>
    )
  }

  if (error && advertisements.length === 0) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Featured Products</h2>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 max-w-2xl mx-auto">
            <p>Error: {error}</p>
          </div>
        </div>
      </section>
    )
  }

  if (advertisements.length === 0) {
    return null
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center"></h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {advertisements.map((ad) => (
            <div key={ad.id} className="rounded-xl overflow-hidden shadow-xl">
              <div className={`bg-gradient-to-r ${ad.bgColor} p-6 md:p-8 ${ad.textColor}`}>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="md:w-1/2">
                    <h3 className="text-2xl md:text-3xl font-bold mb-4">{ad.title}</h3>
                    <p className="mb-6 opacity-90">{ad.description}</p>

                    <Link href={ad.buttonLink}>
                      <button className="group bg-white text-blue-900 hover:bg-blue-50 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center">
                        {ad.buttonText}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </button>
                    </Link>
                  </div>

                  <div className="md:w-1/2 flex items-center justify-center">
                    <img
                      src={ad.image || "/placeholder.svg?height=400&width=600"}
                      alt={ad.title}
                      className="rounded-lg shadow-lg max-h-48 object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=400&width=600"
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
