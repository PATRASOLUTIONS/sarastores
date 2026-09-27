"use client"

import type React from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { apiFetch } from "@/lib/api-client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { normalizeProductForSchema } from "@/lib/product-schema"

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  description: string
  price: number
  mrp?: number
  image: string
  stock: number
  images?: string[] // support up to 5 images
  category?: string
  subCategory?: string
  sku?: string
  slug?: string
  manufacturer?: string
  manufacturerName?: string
  color?: string
  capacity?: string
  features?: string
  ean?: string
  active?: boolean
  // Amazon Scraped Data
  amazonUrl?: string
  amazonManufacturerInfo?: string
  amazonAboutThisItem?: string[]
  amazonDescription?: string
  amazonTechnicalDetails?: Record<string, string>
  amazonReturnPolicy?: string
  amazonWarranty?: string
  amazonWhatsIncluded?: string[]

  // Classification fields
  prod_desc?: string
  group_name?: string
  char_desc?: string

  raw?: {
    Active?: string
    "Item No."?: string
    "Item Description"?: string
    OldCode?: string
    "Old Item Model"?: string
    "AC Second ItemCode"?: string
    "Foreign Name"?: string
    "Tax Category"?: string
    Number?: string
    "Group Name"?: string
    Manufacturer?: string
    "Manufacturer Name"?: string
    "PROD DESC"?: string
    "CHAR DESC"?: string
    "Capacity Description"?: string
    "ITEM CATEGORY"?: string
    "Existing No"?: string
    Features?: string
    "Manage Batch No. [Yes/No]"?: string
    "Serial No. Management"?: string
    "Manual SRNo"?: string
    Revenue?: string
    "Tax Code"?: string
    "Internal Key"?: string
    "Chapter ID"?: string
    "EAN Number"?: string
    Color?: string
    "Samsung Model Code"?: string
    "Samsung Item Type"?: string
    "Purchasing Item"?: string
    "Sales Item"?: string
    "Inventory Item"?: string
    "Buy UOM"?: string
    "Sale UOM"?: string
    EOL?: string
    "In Stock"?: number
    [key: string]: any
  }
}

export default function EditProduct({ params }: { params: any }) {
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [successMessage, setSuccessMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const lock = useSubmitLock()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRawData, setShowRawData] = useState(false)
  const [showAmazonData, setShowAmazonData] = useState(false)
  const router = useRouter()

  // Helper to safely resolve params which may be a Promise in newer Next.js versions
  const resolveParamId = async () => {
    try {
      const resolved = await (params as any)
      return resolved?.id ?? resolved
    } catch (e) {
      // params may not be a promise; fallback to direct property
      return (params as any)?.id ?? params
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Resolve params.id safely (params may be a Promise)
        const id = await resolveParamId()
        // Fetch product
        const productResponse = await apiFetch(`/api/products/${id}?include_inactive=true`, { cache: 'no-store' })
        if (!productResponse.ok) {
          throw new Error("Failed to fetch product")
        }
        const productData = await productResponse.json()

        // Fix for mismatch: Ensure raw['MRP'] matches actual mrp if present
        if (productData.mrp !== undefined && productData.mrp !== null) {
          if (!productData.raw) productData.raw = {}
          // Determine the key to use (prefer 'MRP')
          productData.raw["MRP"] = String(productData.mrp)
        }

        // Fetch categories
        const categoriesResponse = await apiFetch("/api/categories")
        if (!categoriesResponse.ok) {
          throw new Error("Failed to fetch categories")
        }
        const categoriesData = await categoriesResponse.json()
        setCategories(categoriesData)

        // Normalize product category - if it's a name, find the matching category ID
        if (productData.category) {
          const categoryById = categoriesData.find((cat: Category) => cat.id === productData.category)
          if (!categoryById) {
            // Category is not an ID, try to find by name
            const categoryByName = categoriesData.find((cat: Category) =>
              cat.name?.toLowerCase() === productData.category?.toLowerCase() ||
              cat.name === productData.category
            )
            if (categoryByName) {
              productData.category = categoryByName.id
            } else {
              // Try groupName or itemCategory
              const fallbackName = normalizeProductForSchema(productData).categoryGroupName || productData.groupName || productData.itemCategory
              if (fallbackName) {
                const categoryByFallback = categoriesData.find((cat: Category) =>
                  cat.name?.toLowerCase() === fallbackName?.toLowerCase()
                )
                if (categoryByFallback) {
                  productData.category = categoryByFallback.id
                }
              }
            }
          }
        } else {
          // No category set, try to find one from raw data
          const fallbackName = normalizeProductForSchema(productData).categoryGroupName || productData.groupName || productData.itemCategory
          if (fallbackName) {
            const categoryByFallback = categoriesData.find((cat: Category) =>
              cat.name?.toLowerCase() === fallbackName?.toLowerCase()
            )
            if (categoryByFallback) {
              productData.category = categoryByFallback.id
            }
          }
        }

        setProduct(productData)

        // Fetch sub-categories from sub-categories collection
        const subCategoriesResponse = await apiFetch("/api/sub-categories")
        let subCategoriesList: any[] = []
        if (subCategoriesResponse.ok) {
          const subData = await subCategoriesResponse.json()
          subCategoriesList = Array.isArray(subData) ? subData : []
        }

        // Also fetch unique sub-categories from products as fallback
        const productsResponse = await apiFetch("/api/products?include_inactive=true&limit=10000")
        if (productsResponse.ok) {
          const productsData = await productsResponse.json()
          const uniqueSubCategories = new Set<string>()

          productsData.forEach((p: any) => {
            const normalized = normalizeProductForSchema(p)
            // Collect all possible sub-category sources
            if (p.subCategory) uniqueSubCategories.add(p.subCategory)
            if (normalized.subCategoryProdDesc) uniqueSubCategories.add(normalized.subCategoryProdDesc)
            if (normalizeProductForSchema(p).subCategoryProdDesc) uniqueSubCategories.add(normalizeProductForSchema(p).subCategoryProdDesc)
          })

          // Add unique sub-categories from products that aren't already in the list
          const existingNames = new Set(subCategoriesList.map(s => s.name?.toLowerCase()))
          uniqueSubCategories.forEach(name => {
            if (name && !existingNames.has(name.toLowerCase())) {
              subCategoriesList.push({ id: name, name: name })
            }
          })
        }

        // Sort alphabetically
        subCategoriesList.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setSubCategories(subCategoriesList)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")

        // Fallback to localStorage if API fails
        try {
          // Load product from localStorage
          const storedProducts = localStorage.getItem("products")
          if (storedProducts) {
            const products = JSON.parse(storedProducts)
            const id = await resolveParamId()
            const foundProduct = products.find((p: Product) => p.id === id)
            if (foundProduct) {
              setProduct(foundProduct)
            } else {
              throw new Error("Product not found")
            }
          } else {
            throw new Error("No products found")
          }

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

    fetchData()
  }, [params])

  /**
   * Mirrors the classification fields onto the specification sheet.
   *
   * The spec PATCH refuses a locked record unless `locked` is present in the
   * body, so we send the current flag back: the edit goes through and the sheet
   * stays locked afterwards. The product page is the authority for these
   * fields, so it must win over the lock.
   */
  const syncSpecification = async (payload: any, sku: string) => {
    if (!sku) return { synced: false, reason: "no SKU" as const }
    try {
      const current = await apiFetch(`/api/products/specifications/${encodeURIComponent(sku)}/complete`, {
        cache: "no-store",
      })
      if (!current.ok) return { synced: false, reason: "no specification" as const }
      const spec = await current.json()

      const res = await apiFetch(`/api/products/specifications/${encodeURIComponent(sku)}`, {
        method: "PATCH",
        json: {
          name: payload.name,
          category: payload.category,
          subCategory: payload.subCategory,
          prod_desc: payload.prod_desc ?? spec?.prod_desc,
          char_desc: payload.char_desc ?? spec?.char_desc,
          manufacturer_name: payload.manufacturerName ?? payload.manufacturer_name ?? spec?.manufacturer_name,
          mrp: payload.mrp ?? spec?.mrp,
          locked: spec?.locked === true,
        },
      })
      return { synced: res.ok, reason: res.ok ? null : ("patch failed" as const), wasLocked: spec?.locked === true }
    } catch {
      return { synced: false, reason: "error" as const }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    if (!lock.acquire()) return
    setIsSaving(true)
    setError(null)

    try {
      const payload: any = { ...product }

      // remove identifiers from payload to avoid accidental id updates server-side
      delete payload.id
      delete payload._id

      if (Array.isArray(payload.images) && payload.images.length > 0) {
        payload.images = payload.images.filter(Boolean).slice(0, 5)
        if (!payload.image || payload.image !== payload.images[0]) {
          payload.image = payload.images[0]
        }
      } else if (payload.image) {
        payload.images = [payload.image]
      } else {
        payload.images = []
      }

      const id = await resolveParamId()
      const response = await apiFetch(`/api/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => "")
        throw new Error(errText || "Failed to update product")
      }

      const sku = String(product.sku || product.raw?.["itemno"] || "")
      const spec = await syncSpecification(payload, sku)

      setSuccessMessage(
        spec.synced
          ? spec.wasLocked
            ? "Product saved. The locked specification was updated too."
            : "Product saved and the specification was updated."
          : "Product updated successfully!",
      )
      setTimeout(() => setSuccessMessage(""), 3000)

      // Redirect back to products page after successful update
      setTimeout(() => {
        router.push("/admin/products")
      }, 1500)
    } catch (err) {
      console.error("Error updating product:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      lock.release()
      setIsSaving(false)
    }
  }

  const handleRawDataChange = (key: string, value: string) => {
    if (!product) return
    setProduct({
      ...product,
      raw: {
        ...product.raw,
        [key]: value,
      },
    })
  }

  if (isLoading) {
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
          <p>Product not found.</p>
          <p className="mt-2">
            <Link href="/admin/products" className="underline">
              Return to products
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const normalizedProduct = normalizeProductForSchema(product)
  const productSku = String(product.sku || product.raw?.["itemno"] || "")
  // Older products store a category id here rather than the name.
  const categoryLabel =
    categories.find((c: any) => c.id === product.category || c._id === product.category)?.name ??
    product.category

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/products"
            className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>
          <h1 className="truncate text-2xl font-bold text-gray-900">{product.name || "Edit product"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {productSku && (
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono font-semibold text-gray-700">
                {productSku}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                product.active === false ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
              }`}
            >
              {product.active === false ? "Inactive" : "Live"}
            </span>
            {categoryLabel && <span className="text-gray-500">{categoryLabel}</span>}
            {product.subCategory && <span className="text-gray-400">· {product.subCategory}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {productSku && (
            <Link
              href={`/admin/product-specifications?sku=${encodeURIComponent(productSku)}`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Specification sheet
            </Link>
          )}
          {product.slug && (
            <a
              href={`/product/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              View storefront
            </a>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide text-gray-900">
              Basic information
            </h2>
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
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                SKU / Item No.
              </label>
              <input
                type="text"
                id="sku"
                value={normalizedProduct.itemno || ""}
                onChange={(e) => {
                  setProduct({ ...product, sku: e.target.value })
                  handleRawDataChange("itemno", e.target.value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide text-gray-900">
              Pricing &amp; stock
            </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <label htmlFor="mrp" className="block text-sm font-medium text-gray-700 mb-1">
                MRP (₹)
              </label>
              <input
                type="number"
                id="mrp"
                value={product.raw?.["MRP"] ?? product.mrp ?? ""}
                onChange={(e) => {
                  const v = e.target.value
                  const mrpValue = v === '' ? undefined : Number.parseFloat(v)
                  setProduct(prev => {
                    if (!prev) return null
                    return {
                      ...prev,
                      mrp: mrpValue,
                      raw: {
                        ...(prev.raw || {}),
                        "MRP": v
                      }
                    }
                  })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="0"
                step="0.01"
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
                onChange={(e) => {
                  const stockValue = Number.parseInt(e.target.value) || 0
                  setProduct({ ...product, stock: stockValue })
                  handleRawDataChange("In Stock", stockValue.toString())
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="0"
                required
              />
            </div>
          </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide text-gray-900">
              Classification
            </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="manufacturerName" className="block text-sm font-medium text-gray-700 mb-1">
                Manufacturer Name
              </label>
              <input
                type="text"
                id="manufacturerName"
                value={normalizedProduct.manufacturerName || ""}
                onChange={(e) => {
                  setProduct({ ...product, manufacturerName: e.target.value })
                  handleRawDataChange("Manufacturer Name", e.target.value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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

            <div>
              <label htmlFor="subCategory" className="block text-sm font-medium text-gray-700 mb-1">
                Sub Category
              </label>
              <select
                id="subCategory"
                value={product.subCategory || ""}
                onChange={(e) => setProduct({ ...product, subCategory: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a sub-category</option>
                {subCategories.map((sub: any) => (
                  <option key={sub.id || sub._id || sub.name} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prod_desc" className="block text-sm font-medium text-gray-700 mb-1">
                sub-category/PROD DESC
              </label>
              <input
                type="text"
                id="prod_desc"
                value={normalizedProduct.subCategoryProdDesc || ""}
                onChange={(e) => {
                  setProduct({ ...product, prod_desc: e.target.value })
                  handleRawDataChange("sub-category/PROD DESC", e.target.value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>



            <div>
              <label htmlFor="char_desc" className="block text-sm font-medium text-gray-700 mb-1">
                CHAR DESC
              </label>
              <input
                type="text"
                id="char_desc"
                value={normalizedProduct.charDesc || ""}
                onChange={(e) => {
                  setProduct({ ...product, char_desc: e.target.value })
                  handleRawDataChange("CHAR DESC", e.target.value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide text-gray-900">
              Content &amp; media
            </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="features" className="block text-sm font-medium text-gray-700 mb-1">
                Features
              </label>
              <input
                type="text"
                id="features"
                value={product.features || product.raw?.["Features"] || ""}
                onChange={(e) => {
                  setProduct({ ...product, features: e.target.value })
                  handleRawDataChange("Features", e.target.value)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Comma-separated features"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Images (max 5)</label>
              <div className="space-y-3">
                {(product.images || []).map((url, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const next = [...(product.images || [])]
                        next[idx] = e.target.value
                        setProduct({ ...product, images: next })
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder={`Image URL #${idx + 1}`}
                    />
                    <button
                      type="button"
                      className="px-3 py-2 border rounded"
                      onClick={() => {
                        const next = (product.images || []).filter((_, i) => i !== idx)
                        setProduct({ ...product, images: next })
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {(product.images?.length || 0) < 5 && (
                  <button
                    type="button"
                    className="px-4 py-2 border rounded"
                    onClick={() => setProduct({ ...product, images: [...(product.images || []), ""] })}
                  >
                    Add Image
                  </button>
                )}
              </div>
              {/* Preview */}
              {product.images && product.images.length > 0 && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                  {product.images.slice(0, 5).map((u, i) => (
                    <img
                      key={i}
                      src={u || "/placeholder.svg?height=120&width=120"}
                      alt={`Preview ${i + 1}`}
                      className="h-24 object-contain border rounded"
                    />
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">Tip: First image will be used as the primary product image.</p>
            </div>

            {/* Keep single image field for backward compatibility; sync with images[0] */}
            <div className="md:col-span-2">
              <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
                Primary Image URL
              </label>
              <input
                type="text"
                id="image"
                value={product.image}
                onChange={(e) => {
                  const val = e.target.value
                  setProduct({
                    ...product,
                    image: val,
                    images: product.images && product.images.length > 0 ? [val, ...product.images.slice(1)] : [val],
                  })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              {product.image && (
                <div className="mt-2 border rounded p-2">
                  <img
                    src={product.image || "/placeholder.svg?height=200&width=200"}
                    alt={product.name}
                    className="h-40 object-contain mx-auto"
                    onError={(e) => {
                      ; (e.target as HTMLImageElement).src = "/placeholder.svg?height=200&width=200"
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

            {/* <div>
              <label htmlFor="mop" className="block text-sm font-medium text-gray-700 mb-1">
                MOP
              </label>
              <input
                type="text"
                id="mop"
                value={product.raw?.["MOP"] || ""}
                onChange={(e) => handleRawDataChange("MOP", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="mop1" className="block text-sm font-medium text-gray-700 mb-1">
                MOP1
              </label>
              <input
                type="text"
                id="mop1"
                value={product.raw?.["MOP1"] || ""}
                onChange={(e) => handleRawDataChange("MOP1", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="mop2" className="block text-sm font-medium text-gray-700 mb-1">
                MOP2
              </label>
              <input
                type="text"
                id="mop2"
                value={product.raw?.["MOP2"] || ""}
                onChange={(e) => handleRawDataChange("MOP2", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div> */}
          </div>
          </section>

          {/* Amazon Data Section */}
          {/* <div className="border-t pt-6">
            <button
              type="button"
              onClick={() => setShowAmazonData(!showAmazonData)}
              className="flex items-center justify-between w-full text-left text-lg font-medium text-gray-900 mb-4"
            >
              <div className="flex items-center gap-2">
                <span>Amazon Scraped Data</span>
                {product.amazonUrl && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Linked</span>}
              </div>
              {showAmazonData ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>

            {showAmazonData && (
              <div className="space-y-6 bg-orange-50/50 p-6 rounded-lg border border-orange-100 mb-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amazon URL</label>
                    <input
                      type="text"
                      value={product.amazonUrl || ""}
                      onChange={(e) => setProduct({ ...product, amazonUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="https://www.amazon.in/dp/..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Return Policy</label>
                    <input
                      type="text"
                      value={product.amazonReturnPolicy || ""}
                      onChange={(e) => setProduct({ ...product, amazonReturnPolicy: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warranty</label>
                    <input
                      type="text"
                      value={product.amazonWarranty || ""}
                      onChange={(e) => setProduct({ ...product, amazonWarranty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">About This Item (Features)</label>
                  <textarea
                    value={(product.amazonAboutThisItem || []).join('\n')}
                    onChange={(e) => setProduct({ ...product, amazonAboutThisItem: e.target.value.split('\n') })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={5}
                    placeholder="One feature per line"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Description</label>
                  <textarea
                    value={product.amazonDescription || ""}
                    onChange={(e) => setProduct({ ...product, amazonDescription: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer Info</label>
                  <textarea
                    value={product.amazonManufacturerInfo || ""}
                    onChange={(e) => setProduct({ ...product, amazonManufacturerInfo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Technical Details</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newDetails = { ...(product.amazonTechnicalDetails || {}), "": "" }
                        setProduct({ ...product, amazonTechnicalDetails: newDetails })
                      }}
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-3 w-3" /> Add Field
                    </button>
                  </div>

                  <div className="space-y-2 bg-white p-4 rounded-md border border-gray-200">
                    {Object.entries(product.amazonTechnicalDetails || {}).map(([key, value], idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newKey = e.target.value
                            const entries = Object.entries(product.amazonTechnicalDetails || {})
                            entries[idx][0] = newKey
                            setProduct({ ...product, amazonTechnicalDetails: Object.fromEntries(entries) })
                          }}
                          className="w-1/3 px-2 py-1 border border-gray-300 rounded text-sm font-medium bg-gray-50"
                          placeholder="Key"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => {
                            const newValue = e.target.value
                            const entries = Object.entries(product.amazonTechnicalDetails || {})
                            entries[idx][1] = newValue
                            setProduct({ ...product, amazonTechnicalDetails: Object.fromEntries(entries) })
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Value"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const entries = Object.entries(product.amazonTechnicalDetails || {})
                            entries.splice(idx, 1)
                            setProduct({ ...product, amazonTechnicalDetails: Object.fromEntries(entries) })
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {(!product.amazonTechnicalDetails || Object.keys(product.amazonTechnicalDetails).length === 0) && (
                      <p className="text-sm text-gray-400 italic text-center py-2">No technical details available</p>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div> */}

          {product.raw && Object.keys(product.raw).length > 0 && (
            <div className="border-t pt-6">
              <button
                type="button"
                onClick={() => setShowRawData(!showRawData)}
                className="flex items-center justify-between w-full text-left text-lg font-medium text-gray-900 mb-4"
              >
                <span>Additional Raw Data Fields</span>
                {showRawData ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>

              {showRawData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-md">
                  {Object.entries(product.raw).filter(([key]) => key !== 'MRP').map(([key, value]) => (
                    <div key={key}>
                      <label htmlFor={`raw-${key}`} className="block text-sm font-medium text-gray-700 mb-1">
                        {key}
                      </label>
                      <input
                        type="text"
                        id={`raw-${key}`}
                        value={value?.toString() || ""}
                        onChange={(e) => handleRawDataChange(key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <p className="text-xs text-gray-500">
                Saving also updates this product&rsquo;s specification sheet, even if it is locked.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/admin/products"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`${isSaving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
                    } flex items-center rounded-lg px-6 py-2 text-sm font-semibold text-white transition-colors`}
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
