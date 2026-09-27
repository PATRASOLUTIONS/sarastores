"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { ShoppingBag, Package, AlertCircle, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function VendorDashboardPage() {
  const { user, isVendor, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
  })
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading) {
      if (!isVendor) {
        router.push("/login")
        return
      }
      fetchVendorData()
    }
  }, [user, isVendor, router, isLoading])

  const fetchVendorData = async () => {
    try {
      // Fetch vendor's products
      const productsResponse = await fetch(`/api/vendor/products?vendorId=${user?.id}`)

      if (productsResponse.ok) {
        const products = await productsResponse.json()
        const activeProducts = products.filter((p: any) => p.active !== false)
        const lowStockProducts = products.filter((p: any) => p.stock < 10)

        setStats({
          totalProducts: products.length,
          activeProducts: activeProducts.length,
          lowStockProducts: lowStockProducts.length,
        })
      }
    } catch (error) {
      console.error("Error fetching vendor data:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsPageLoading(false)
    }
  }

  const retryConnection = () => {
    setIsPageLoading(true)
    setError(null)
    fetchVendorData()
  }

  if (isLoading || isPageLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
          <p className="ml-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isVendor) {
    return null
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Vendor Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user?.name || "Vendor"}!</p>
          </div>
          <button
            onClick={retryConnection}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-semibold">Error Loading Data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card className="p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 md:p-3 rounded-full mr-3 md:mr-4">
              <ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-blue-800" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-gray-500">Total Products</p>
              <h3 className="text-lg md:text-2xl font-bold">{stats.totalProducts}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-2 md:p-3 rounded-full mr-3 md:mr-4">
              <Package className="h-5 w-5 md:h-6 md:w-6 text-green-800" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-gray-500">Active Products</p>
              <h3 className="text-lg md:text-2xl font-bold">{stats.activeProducts}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <div className="flex items-center">
            <div className="bg-orange-100 p-2 md:p-3 rounded-full mr-3 md:mr-4">
              <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-orange-800" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-gray-500">Low Stock</p>
              <h3 className="text-lg md:text-2xl font-bold">{stats.lowStockProducts}</h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:gap-8">
        <Card className="p-4 md:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg md:text-xl font-semibold">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/vendor/products/new">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 mr-2" />
                Add New Product
              </button>
            </Link>
            <Link href="/vendor/products">
              <button className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 mr-2" />
                Manage Products
              </button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
