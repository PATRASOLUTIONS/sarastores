"use client"

import { useState, useEffect } from "react"
import { CheckCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"

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

export default function AdvertisementCarousel() {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch advertisements
  useEffect(() => {
    const fetchAdvertisements = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("/api/advertisements")

        if (!response.ok) {
          throw new Error("Failed to fetch advertisements")
        }

        const data = await response.json()

        // Filter active advertisements and sort by order
        const activeAds = data
          .filter((ad: Advertisement) => ad.active)
          .sort((a: Advertisement, b: Advertisement) => a.order - b.order)

        setAdvertisements(activeAds)
        setError(null)
      } catch (error) {
        console.error("Error fetching advertisements:", error)
        setError("Failed to load advertisements")

        // Fallback to localStorage
        try {
          const storedAds = localStorage.getItem("advertisements")
          if (storedAds) {
            const parsedAds = JSON.parse(storedAds)
            const activeAds = parsedAds
              .filter((ad: Advertisement) => ad.active)
              .sort((a: Advertisement, b: Advertisement) => a.order - b.order)

            setAdvertisements(activeAds)
            setError(null)
          }
        } catch (localError) {
          console.error("Error loading from localStorage:", localError)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchAdvertisements()
  }, [])

  // Parse description into bullet points
  const parseDescriptionPoints = (description: string) => {
    // Split by pipe character if it exists, otherwise assume it's a single point
    if (description.includes("|")) {
      return description
        .split("|")
        .map((point) => point.trim())
        .filter(Boolean)
    }

    // Alternative: split by newlines if they exist
    if (description.includes("\n")) {
      return description
        .split("\n")
        .map((point) => point.trim())
        .filter(Boolean)
    }

    // If no delimiter found, treat as a single point
    return [description]
  }

  // If loading or no active advertisements, don't render anything
  if (isLoading || advertisements.length === 0) {
    return null
  }

  return (
    <div className="w-full mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {advertisements.map((ad) => (
          <motion.div
            key={ad.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
            }}
            className={`${ad.bgColor} ${ad.textColor} rounded-lg overflow-hidden shadow-2xl relative`}
          >
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />

            <div className="p-6 flex flex-col md:flex-row items-center relative z-10">
              <div className="md:w-1/2 mb-6 md:mb-0 md:pr-8">
                <motion.h2
                  className="text-2xl md:text-3xl font-bold mb-4"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  {ad.title}
                  {ad.featured && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Featured
                    </span>
                  )}
                </motion.h2>

                <div className="space-y-2 mb-4">
                  {parseDescriptionPoints(ad.description).map((point, index) => (
                    <motion.div
                      key={index}
                      className="flex items-start"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                    >
                      <CheckCircle className="h-5 w-5 mr-2 mt-1 flex-shrink-0" />
                      <p className="text-sm md:text-base">{point}</p>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <Link href={ad.buttonLink}>
                    <motion.button
                      className="px-6 py-3 min-h-[44px] bg-white text-gray-900 rounded-xl font-medium shadow-md group relative overflow-hidden touch-manipulation"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="absolute inset-0 w-0 bg-opacity-20 bg-white group-hover:w-full transition-all duration-500 ease-out" />
                      <span className="relative">{ad.buttonText}</span>
                    </motion.button>
                  </Link>
                </motion.div>
              </div>

              <motion.div
                className="md:w-1/2"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <div className="relative overflow-hidden rounded-lg shadow-2xl h-48 md:h-64">
                  <Image
                    src={ad.image || "/placeholder.svg"}
                    alt={ad.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    quality={75}
                  />\n                </div>
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add framer-motion styles */}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  )
}
