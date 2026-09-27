"use client"

import type React from "react"
import { apiFetch } from "@/lib/api-client"

import { useState, useEffect } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

const REQUIRED_FIELDS = [
  "Active", "Item No.", "Item Description", "OldCode", "Old Item Model", "AC Second ItemCode", "Foreign Name",
  "Tax Category", "SuperCode", "Status", "VendorCode", "VendorName", "Number", "Group Name",
  "Manufacturer Name", "PROD DESC", "CHAR DESC", "Capacity Description", "ITEM CATEGORY", "Existing No", "Features",
  "Manage Batch No. [Yes/No]", "Serial No. Management", "Manual SRNo", "Revenue", "Tax Code", "Internal Key",
  "Chapter ID", "EAN Number", "Color", "Samsung Model Code", "Samsung Item Type", "Purchasing Item", "Sales Item",
  "Inventory Item", "Buy UOM", "Sale UOM", "EOL", "In Stock", "MOP", "MOP1", "MOP2"
];


interface Category {
  id: string
  name: string
}

interface Product {
  name: string
  description: string
  price: number
  stock: number
  category?: string
  image?: string
  images?: string[]
  sku?: string
  manufacturer?: string
  manufacturerName?: string
  color?: string
  capacity?: string
  features?: string
  groupName?: string
  itemCategory?: string
  ean?: string
  active?: boolean
  source?: string
  raw?: { [key: string]: any }
}

export default function NewProduct() {
  const [product, setProduct] = useState<Product>({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    category: "",
    images: ["", "", "", "", ""],
    active: true,
    raw: {},
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [successMessage, setSuccessMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const lock = useSubmitLock()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch categories
        const categoriesResponse = await apiFetch("/api/categories")
        if (!categoriesResponse.ok) {
          throw new Error("Failed to fetch categories")
        }
        const categoriesData = await categoriesResponse.json()
        setCategories(categoriesData)
      } catch (err) {
        console.error("Error fetching categories:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")

        // Fallback to localStorage if API fails
        try {
          // Load categories from localStorage
          const storedCategories = localStorage.getItem("categories")
          if (storedCategories) {
            setCategories(JSON.parse(storedCategories))
          }
        } catch (localError) {
          console.error("Error loading from localStorage:", localError)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategories()
  }, [])

  const updateImageAt = (idx: number, val: string) => {
    setProduct((prev) => {
      const next = [...(prev.images || ["", "", "", "", ""])]
      next[idx] = val
      return { ...prev, images: next }
    })
  }

  // Helper to update raw fields
  const handleRawFieldChange = (key: string, value: string) => {
    setProduct((prev) => ({
      ...prev,
      raw: { ...prev.raw, [key]: value }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!product.name || !product.description || product.price <= 0 || !product.sku) {
      setError("Please fill in all required fields")
      return
    }

    if (!lock.acquire()) return
    setIsSaving(true)
    setError(null)

    try {
      // Check SKU uniqueness
      const checkRes = await apiFetch(`/api/products/sku/${encodeURIComponent(product.sku)}?check=true`)
      if (checkRes.ok) {
        const exists = await checkRes.json()
        if (exists.found) {
          const proceed = window.confirm(
            "A product with this SKU already exists. Proceeding will replace that product data. Continue?"
          )
          if (!proceed) {
            setIsSaving(false)
            return
          }
        }
      }

      // Create or replace product via API
      const res = await apiFetch(`/api/products?replace=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.details || errData.error || "Failed to create/replace product")
      }

      setSuccessMessage("Product saved successfully!")
      setTimeout(() => router.push("/admin/products"), 1200)
    } catch (err) {
      console.error("Error creating product:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")

      // Fallback to localStorage if API fails
      try {
        // Get all products from localStorage
        const storedProducts = localStorage.getItem("products")
        const products = storedProducts ? JSON.parse(storedProducts) : []

        // Create a new product with a unique ID
        const newProduct = {
          id: `product-${Date.now()}`,
          ...product,
        }

        // Add to products array
        products.push(newProduct)

        // Save back to localStorage
        localStorage.setItem("products", JSON.stringify(products))

        // Show success message
        setSuccessMessage("Product created successfully (saved to localStorage as fallback)!")

        // Redirect to products page after successful creation
        setTimeout(() => {
          router.push("/admin/products")
        }, 1200)
      } catch (localError) {
        console.error("Error saving to localStorage:", localError)
        setError("Failed to create product. Please try again.")
      }
    } finally {
      lock.release()
      setIsSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Add New Product</h1>
        <Link href="/admin/products">
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
                Product Name <span className="text-red-500">*</span>
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
                Price (₹) <span className="text-red-500">*</span>
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
                Stock <span className="text-red-500">*</span>
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
                Description <span className="text-red-500">*</span>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={product.sku || ""}
                onChange={(e) => setProduct({ ...product, sku: e.target.value.trim() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer Name</label>
              <input
                type="text"
                value={product.manufacturerName || ""}
                onChange={(e) => setProduct({ ...product, manufacturerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={product.color || ""}
                onChange={(e) => setProduct({ ...product, color: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input
                type="text"
                value={product.capacity || ""}
                onChange={(e) => setProduct({ ...product, capacity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Features</label>
              <input
                type="text"
                value={product.features || ""}
                onChange={(e) => setProduct({ ...product, features: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
              <input
                type="text"
                value={product.groupName || ""}
                onChange={(e) => setProduct({ ...product, groupName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Category</label>
              <input
                type="text"
                value={product.itemCategory || ""}
                onChange={(e) => setProduct({ ...product, itemCategory: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">EAN</label>
              <input
                type="text"
                value={product.ean || ""}
                onChange={(e) => setProduct({ ...product, ean: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="border-t pt-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">Additional Product Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {REQUIRED_FIELDS.map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{key}</label>
                  <input
                    type="text"
                    value={product.raw?.[key] || ""}
                    onChange={(e) => handleRawFieldChange(key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Images (up to 5)</label>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <input
                    type="text"
                    placeholder={`Image URL ${i + 1}`}
                    value={(product.images || ["", "", "", "", ""])[i] || ""}
                    onChange={(e) => updateImageAt(i, e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <div className="mt-2 border rounded p-2 h-28 flex items-center justify-center bg-gray-50">
                    <img
                      src={(product.images && product.images[i]) || "/placeholder.svg?height=100&width=100"}
                      alt={`Preview ${i + 1}`}
                      className="h-24 object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=100&width=100"
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">First image becomes the primary image.</p>
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
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
