"use client"

import type React from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  stock: number
  category?: string
  vendorId?: string
}

export default function EditVendorProduct({ params }: { params: { id: string } }) {
  const { user, isVendor, isLoading } = useAuth()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [successMessage, setSuccessMessage] = useState("")
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const lock = useSubmitLock()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading) {
      if (!isVendor) {
        router.push("/login")
        return
      }
      fetchData()
    }
  }, [user, isVendor, isLoading, router, params.id])

  const fetchData = async () => {
    try {
      setIsPageLoading(true)

      // Fetch product
      const productResponse = await fetch(`/api/vendor/products/${params.id}`)
      if (!productResponse.ok) {
        throw new Error("Failed to fetch product")
      }
      const productData = await productResponse.json()

      // Verify vendor owns this product
      if (productData.vendorId !== user?.id) {
        throw new Error("Unauthorized: You don't own this product")
      }

      setProduct(productData)

      // Fetch categories
      const categoriesResponse = await fetch("/api/categories")
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        setCategories(categoriesData)
      }
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsPageLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    if (!lock.acquire()) return
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/vendor/products/${product.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(product),
      })

      if (!response.ok) {
        throw new Error("Failed to update product")
      }

      setSuccessMessage("Product updated successfully!")
      setTimeout(() => {
        router.push("/vendor/products")
      }, 1500)
    } catch (err) {
      console.error("Error updating product:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      lock.release()
      setIsSaving(false)
    }
  }

  if (isLoading || isPageLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>Product not found or you don't have permission to edit it.</p>
          <p className="mt-2">
            <Link href="/vendor/products" className="underline">
              Return to products
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Edit Product</h1>
        <Link href="/vendor/products">
          <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </button>
        </Link>
      </div>

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Product Name
              </label>
              <input
                type="text"
                id="name"
                value={product.name}
                onChange={(e) => setProduct({ ...product, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                Price (₹)
              </label>
              <input
                type="number"
                id="price"
                value={product.price}
                onChange={(e) => setProduct({ ...product, price: Number.parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label htmlFor="stock" className="block text-sm font-medium text-gray-700 mb-1">
                Stock
              </label>
              <input
                type="number"
                id="stock"
                value={product.stock}
                onChange={(e) => setProduct({ ...product, stock: Number.parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="0"
                required
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category"
                value={product.category || ""}
                onChange={(e) => setProduct({ ...product, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
                Image URL
              </label>
              <input
                type="text"
                id="image"
                value={product.image}
                onChange={(e) => setProduct({ ...product, image: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              {product.image && (
                <div className="mt-2 border rounded p-2">
                  <img
                    src={product.image || "/placeholder.svg?height=200&width=200"}
                    alt={product.name}
                    className="h-40 object-contain mx-auto"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=200&width=200"
                    }}
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={product.description}
                onChange={(e) => setProduct({ ...product, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={5}
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className={`${
                isSaving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              } text-white px-6 py-2 rounded-lg flex items-center transition-colors`}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
