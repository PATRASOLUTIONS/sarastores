"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Edit, Trash2, Search, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"

interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  stock: number
  category?: string
  vendorId?: string
  active?: boolean
}

export default function VendorProductsPage() {
  const { user, isVendor, isLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading) {
      if (!isVendor) {
        router.push("/login")
        return
      }
      fetchProducts()
    }
  }, [user, isVendor, router, isLoading])

  useEffect(() => {
    // Filter products based on search term
    if (searchTerm) {
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredProducts(filtered)
    } else {
      setFilteredProducts(products)
    }
  }, [searchTerm, products])

  const fetchProducts = async () => {
    try {
      setIsPageLoading(true)
      const response = await fetch(`/api/vendor/products?vendorId=${user?.id}`)

      if (response.ok) {
        const data = await response.json()
        setProducts(data)
        setFilteredProducts(data)
      } else {
        throw new Error("Failed to fetch products")
      }
    } catch (error) {
      console.error("Error fetching products:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsPageLoading(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return
    }

    try {
      const response = await fetch(`/api/vendor/products/${productId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setProducts(products.filter((p) => p.id !== productId))
      } else {
        throw new Error("Failed to delete product")
      }
    } catch (error) {
      console.error("Error deleting product:", error)
      alert("Failed to delete product. Please try again.")
    }
  }

  if (isLoading || isPageLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
          <p className="ml-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">My Products</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchProducts}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <Link href="/vendor/products/new">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </button>
          </Link>
        </div>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      {filteredProducts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500 mb-4">No products found</p>
          <Link href="/vendor/products/new">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              Add Your First Product
            </button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <img
                src={product.image || "/placeholder.svg?height=200&width=300"}
                alt={product.name}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=200&width=300"
                }}
              />
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2 line-clamp-2">{product.name}</h3>
                <p className="text-gray-600 text-sm mb-2 line-clamp-2">{product.description}</p>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl font-bold text-blue-800">₹{product.price.toFixed(2)}</span>
                  <span className={`text-sm ${product.stock < 10 ? "text-red-600" : "text-gray-600"}`}>
                    Stock: {product.stock}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/vendor/products/${product.id}/edit`} className="flex-1">
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center justify-center">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
