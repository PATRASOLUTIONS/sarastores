"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/hooks/useCart"
import Link from "next/link"
import { ShoppingCart, ArrowRight } from "lucide-react"

export default function DashboardCartPage() {
  const { cart, isLoading } = useCart()
  const router = useRouter()

  // Redirect to the main cart page
  useEffect(() => {
    router.push("/cart")
  }, [router])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 bg-gray-50 border-b">
        <h2 className="text-xl font-semibold">My Cart</h2>
      </div>

      <div className="p-6">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-6">
            <ShoppingCart className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Redirecting to Cart</h3>
          <p className="text-gray-600 mb-6">You are being redirected to the main cart page.</p>
          <Link href="/cart">
            <button className="px-6 py-2 bg-maroon-800 text-white rounded-md hover:bg-maroon-900 transition-colors flex items-center mx-auto">
              <span>Go to Cart</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
