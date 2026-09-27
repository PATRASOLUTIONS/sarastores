"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ShoppingCart, TrendingUp, Eye } from "lucide-react"

// Default popular products if none are found in localStorage
const defaultPopularProducts = [
  {
    id: "pop1",
    name: "Wireless Headphones",
    description: "Premium wireless headphones with noise cancellation technology.",
    price: 9749,
    image: "https://placehold.co/300x300/222222/FFFFFF?text=Wireless+Headphones",
    sales: 1250,
  },
  {
    id: "pop2",
    name: "Smartphone",
    description: "Latest model smartphone with high-resolution camera and fast processor.",
    price: 52499,
    image: "https://placehold.co/300x300/333333/FFFFFF?text=Smartphone",
    sales: 980,
  },
  {
    id: "pop3",
    name: "Laptop",
    description: "Powerful laptop for work and gaming with long battery life.",
    price: 97499,
    image: "https://placehold.co/300x300/444444/FFFFFF?text=Laptop",
    sales: 750,
  },
]

export default function PopularProductsSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [popularProducts, setPopularProducts] = useState(defaultPopularProducts)

  useEffect(() => {
    // Load popular products from localStorage if available
    try {
      const storedPopularProducts = localStorage.getItem("popularProducts")
      if (storedPopularProducts) {
        setPopularProducts(JSON.parse(storedPopularProducts))
      }
    } catch (error) {
      console.error("Error loading popular products:", error)
    }

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
  }, [])

  return (
    <section ref={sectionRef} className="py-20 bg-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <h2 className="text-3xl font-bold mb-4">Most Demanded Products</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Our customers can't get enough of these top-selling items. See what everyone's talking about!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {popularProducts.map((product, index) => (
            <div
              key={product.id}
              className={`bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 transition-all duration-500 transform ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"
              } hover:-translate-y-2`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="relative overflow-hidden group">
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-64 object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                {/* Trending badge */}
                <div className="absolute top-4 left-4 z-10">
                  <div className="flex items-center bg-blue-800 text-white px-3 py-1.5 rounded-full text-xs font-bold">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>Most Demanded</span>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="absolute bottom-4 left-4 right-4 flex gap-2 transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <Link href={`/product/${(product as any).slug || product.id}`} className="flex-1">
                    <button className="w-full bg-white text-maroon-800 py-2 rounded-lg font-medium flex items-center justify-center hover:bg-gray-100 transition-colors">
                      <Eye className="h-4 w-4 mr-2" />
                      Quick View
                    </button>
                  </Link>
                  <Link href={`/cart?add=${product.id}`} className="flex-1">
                    <button className="w-full bg-blue-800 text-white py-2 rounded-lg font-medium flex items-center justify-center hover:bg-blue-900 transition-colors">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add to Cart
                    </button>
                  </Link>
                </div>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-semibold">{product.name}</h3>
                  <span className="text-sm text-gray-500">{product.sales} sold</span>
                </div>
                <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>

                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-blue-800">₹{product.price.toLocaleString("en-IN")}</span>
                  <div className="flex items-center text-green-600 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span>High Demand</span>
                  </div>
                </div>

                {/* Progress bar to show popularity */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-800 h-2.5 rounded-full"
                      style={{ width: `${Math.min(85 + index * 5, 98)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Almost sold out! Order now while supplies last.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
