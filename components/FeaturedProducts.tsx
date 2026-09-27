"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowRight, ShoppingCart } from "lucide-react"

// Default featured products if none are found in the database
const defaultFeaturedProducts = [
  {
    id: "feat1",
    name: "Wireless Headphones",
    description: "Premium wireless headphones with noise cancellation technology.",
    price: 9749,
    image: "https://placehold.co/300x300/222222/FFFFFF?text=Wireless+Headphones",
  },
  {
    id: "feat2",
    name: "Smartphone",
    description: "Latest model smartphone with high-resolution camera and fast processor.",
    price: 52499,
    image: "https://placehold.co/300x300/333333/FFFFFF?text=Smartphone",
  },
  {
    id: "feat3",
    name: "Laptop",
    description: "Powerful laptop for work and gaming with long battery life.",
    price: 97499,
    image: "https://placehold.co/300x300/444444/FFFFFF?text=Laptop",
  },
]

interface Product {
  id: string
  slug?: string
  name: string
  description: string
  price: number
  image: string
}

interface FeaturedProductsProps {
  products?: Product[]
}

export default function FeaturedProducts({ products: propProducts }: FeaturedProductsProps) {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      // If products are provided as props, use them
      if (propProducts && propProducts.length > 0) {
        setFeaturedProducts(propProducts)
        setIsLoading(false)
        return
      }

      try {
        if (process.env.NODE_ENV === "development") console.log("Fetching featured products from API...")
        const response = await fetch("/api/featured-products")

        if (!response.ok) {
          throw new Error(`Failed to fetch featured products: ${response.status}`)
        }

        const data = await response.json()
        if (process.env.NODE_ENV === "development") console.log("Featured products fetched:", data)

        if (Array.isArray(data) && data.length > 0) {
          setFeaturedProducts(data)
          // Store in localStorage as backup
          localStorage.setItem("featuredProducts", JSON.stringify(data))
        } else {
          if (process.env.NODE_ENV === "development") console.log("No featured products found in API response, using default products")
          // Try localStorage fallback
          const storedFeaturedProducts = localStorage.getItem("featuredProducts")
          if (storedFeaturedProducts) {
            try {
              const parsed = JSON.parse(storedFeaturedProducts)
              setFeaturedProducts(parsed)
            } catch (e) {
              console.error("Error parsing stored products:", e)
              setFeaturedProducts(defaultFeaturedProducts)
            }
          } else {
            setFeaturedProducts(defaultFeaturedProducts)
          }
        }
      } catch (err) {
        console.error("Error fetching featured products:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")

        // Try localStorage fallback
        try {
          const storedFeaturedProducts = localStorage.getItem("featuredProducts")
          if (storedFeaturedProducts) {
            const parsed = JSON.parse(storedFeaturedProducts)
            setFeaturedProducts(parsed)
            setError(null) // Clear error if localStorage has data
          } else {
            setFeaturedProducts(defaultFeaturedProducts)
          }
        } catch (localErr) {
          console.error("Error loading from localStorage:", localErr)
          setFeaturedProducts(defaultFeaturedProducts)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeaturedProducts()

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [propProducts])

  // Update the product images if needed
  const enhancedProducts = featuredProducts.map((product, index) => ({
    ...product,
    image:
      product.image ||
      `https://placehold.co/400x400/${222222 + index * 111111}/FFFFFF?text=${encodeURIComponent(product.name)}`,
  }))

  if (isLoading) {
    return (
      <section className="py-20 bg-white text-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Featured Products</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Loading our featured products...</p>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
          </div>
        </div>
      </section>
    )
  }

  if (error && featuredProducts.length === 0) {
    return (
      <section className="py-20 bg-white text-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Featured Products</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We're having trouble loading our featured products. Please try again later.
            </p>
          </div>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 max-w-2xl mx-auto">
            <p>{error}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={sectionRef} className="py-20 bg-white text-gray-900">
      <div className="container mx-auto px-4">
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <h2 className="text-3xl font-bold mb-4">Featured Products</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Check out our most popular items that customers love. Quality products at great prices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {enhancedProducts.map((product, index) => (
            <Link href={`/product/${product.slug || product.id}`} key={product.id}>
              <div
                className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="relative overflow-hidden group">
                  <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className="w-full h-64 object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute bottom-4 left-4 right-4 transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <button className="bg-blue-800 text-white w-full py-2 rounded-lg font-medium flex items-center justify-center">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Quick View
                    </button>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
                    <span className="bg-maroon-100 text-maroon-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                      New
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-blue-800">₹{product.price.toLocaleString("en-IN")}</span>
                    <button className="group bg-blue-800 text-white px-4 py-2 rounded-lg hover:bg-blue-900 transition-colors flex items-center">
                      Details
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div
          className={`text-center mt-12 transition-all duration-700 delay-500 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <Link href="/products">
            <button className="group bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors inline-flex items-center">
              View All Products
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  )
}
