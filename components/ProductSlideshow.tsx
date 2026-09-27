"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Pause, Play, ExternalLink, ArrowRight } from "lucide-react"

// Define types for our product slides
interface ProductSlide {
  id: string
  categoryId: string
  categoryName: string
  products: {
    id: string
    slug?: string
    name: string
    price: number
    image: string
  }[]
}

interface Category {
  id: string
  name: string
  image: string
  count?: number
  description: string
}

export default function ProductSlideshow() {
  const [activeCategory, setActiveCategory] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [productSlides, setProductSlides] = useState<ProductSlide[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMounted = useRef(true)

  // Load product slides and categories from API
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch product slides
        const slidesResponse = await fetch("/api/product-slides")
        if (!slidesResponse.ok) {
          throw new Error("Failed to fetch product slides")
        }
        const slidesData = await slidesResponse.json()

        // Fetch categories
        const categoriesResponse = await fetch("/api/categories")
        if (!categoriesResponse.ok) {
          throw new Error("Failed to fetch categories")
        }
        const categoriesData = await categoriesResponse.json()

        if (isMounted.current) {
          setProductSlides(slidesData)
          setCategories(categoriesData)
        }
      } catch (err) {
        console.error("Error loading data:", err)
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : "An unknown error occurred")

          // Fallback to localStorage if API fails
          try {
            const storedSlides = localStorage.getItem("productSlides")
            const storedCategories = localStorage.getItem("categories")

            if (storedSlides) {
              setProductSlides(JSON.parse(storedSlides))
            }

            if (storedCategories) {
              setCategories(JSON.parse(storedCategories))
              setError(null) // Clear error if localStorage has data
            }
          } catch (localErr) {
            console.error("Error loading from localStorage:", localErr)
          }
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    // Set isMounted to true when component mounts
    isMounted.current = true

    // Cleanup function
    return () => {
      isMounted.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  // Function to move to the next slide
  const nextSlide = () => {
    if (isMounted.current && productSlides.length > 0) {
      setActiveCategory((prev) => (prev + 1) % productSlides.length)
    }
  }

  // Function to move to the previous slide
  const prevSlide = () => {
    if (isMounted.current && productSlides.length > 0) {
      setActiveCategory((prev) => (prev - 1 + productSlides.length) % productSlides.length)
    }
  }

  // Toggle pause/play
  const togglePause = () => {
    if (isMounted.current) {
      setIsPaused((prev) => !prev)
    }
  }

  // Set up automatic sliding
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Only set interval if not paused and we have slides
    if (!isPaused && productSlides.length > 0) {
      intervalRef.current = setInterval(() => {
        if (isMounted.current) {
          nextSlide()
        }
      }, 5000) // Change slide every 5 seconds
    }

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPaused, productSlides.length])

  // Function to count products per category
  const getProductCount = (categoryId: string) => {
    // This would ideally be fetched from the API
    // For now, we'll return a random number between 10 and 50
    return Math.floor(Math.random() * 40) + 10
  }

  if (isLoading) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Featured Categories</h2>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Featured Categories</h2>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        </div>
      </section>
    )
  }

  if (productSlides.length === 0 || categories.length === 0) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Featured Categories</h2>
          <div className="text-center py-8">
            <p className="text-gray-500">No product categories available at the moment.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">Featured Categories</h2>

        <div className="relative">
          {/* Slideshow container */}
          <div className="overflow-hidden rounded-lg bg-white shadow-lg">
            {productSlides.map((slide, index) => (
              <div
                key={slide.id}
                className={`transition-opacity duration-500 ${
                  activeCategory === index ? "block opacity-100" : "hidden opacity-0"
                }`}
              >
                <div className="p-6 bg-blue-800 text-white">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold">{slide.categoryName}</h3>
                    <Link
                      href={`/products?category=${slide.categoryId}`}
                      className="flex items-center text-white hover:text-maroon-200 transition-colors"
                    >
                      <span className="mr-2">View More</span>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {/* Shop by Category Section */}
                <div className="p-6 border-b border-gray-200">
                  <h4 className="text-xl font-semibold mb-4">Shop by Category</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {categories.slice(0, 4).map((category) => (
                      <Link href={`/products?category=${category.id}`} key={category.id}>
                        <div className="group bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
                          <div className="relative h-40 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10"></div>
                            <img
                              src={category.image || "/placeholder.svg?height=200&width=200"}
                              alt={category.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 flex flex-col justify-end p-4 z-20 text-white">
                              <h3 className="text-lg font-bold mb-1">{category.name}</h3>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium">
                                  {category.count || getProductCount(category.id)} Products
                                </span>
                                <span className="bg-white/20 p-1 rounded-full group-hover:bg-blue-600 transition-colors">
                                  <ArrowRight className="h-3 w-3" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-6">
                  {slide.products.map((product) => (
                    <Link href={`/product/${product.slug || product.id}`} key={product.id}>
                      <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <img
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          className="w-full h-48 object-cover"
                        />
                        <div className="p-4">
                          <h4 className="font-semibold mb-2 truncate">{product.name}</h4>
                          <p className="text-blue-800 font-bold">₹{product.price.toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Navigation controls - moved below the slideshow */}
          <div className="flex justify-center items-center mt-6 space-x-4">
            <button
              onClick={prevSlide}
              className="p-2 rounded-full bg-blue-800 text-white hover:bg-blue-900 transition-colors"
              aria-label="Previous category"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              onClick={togglePause}
              className="p-2 rounded-full bg-blue-800 text-white hover:bg-blue-900 transition-colors"
              aria-label={isPaused ? "Play slideshow" : "Pause slideshow"}
            >
              {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </button>

            <button
              onClick={nextSlide}
              className="p-2 rounded-full bg-blue-800 text-white hover:bg-blue-900 transition-colors"
              aria-label="Next category"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Slide indicators */}
          <div className="flex justify-center mt-4 space-x-2">
            {productSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveCategory(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  activeCategory === index ? "bg-blue-800 w-6" : "bg-gray-300"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
