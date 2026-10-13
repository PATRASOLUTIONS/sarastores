"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, use, useRef } from "react"
import { z } from "zod"
import { partnerAssignmentProductResponseSchema, partnerAssignmentsResponseSchema } from "@/lib/product-card-response"
import type { PartnerAssignmentProductResponse } from "@/lib/product-card-response"
import {
  ArrowLeft,
  Search,
  Package,
  Check,
  X,
  RefreshCw,
  Plus,
  Minus,
  Filter,
  Image as ImageIcon
} from "lucide-react"
import Link from "next/link"
import { toast } from "react-hot-toast"

type Product = PartnerAssignmentProductResponse

interface Partner {
  id: string;
  name: string;
  tier: string;
}

const partnerResponseSchema = z.object({
  success: z.literal(true), data: z.object({ partner: z.object({ id: z.string(), name: z.string(), tier: z.string() }) }),
})

export default function PartnerProductsPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = use(params)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [enabledProducts, setEnabledProducts] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [categories, setCategories] = useState<string[]>([])
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const latestRequest = useRef(0)

  useEffect(() => {
    fetchData()
  }, [partnerId])

  const fetchData = async () => {
    const requestId = ++latestRequest.current
    setIsLoading(true)
    setLoadFailed(false)
    try {
      const [partnerRes, assignRes] = await Promise.all([
        apiFetch(`/api/admin/partners/${partnerId}`),
        apiFetch(`/api/admin/partners/${partnerId}/products?t=${Date.now()}`),
      ])
      if (!partnerRes.ok || !assignRes.ok) throw new Error("Partner assignments could not be loaded")
      const partnerData = partnerResponseSchema.parse(await partnerRes.json())
      const assignData = partnerAssignmentsResponseSchema.parse(await assignRes.json())
      const allProducts: Product[] = []
      for (let skip = 0; ; skip += 1000) {
        const productsRes = await apiFetch(`/api/products?limit=1000&skip=${skip}`)
        if (!productsRes.ok) throw new Error("Catalogue could not be loaded")
        const page = partnerAssignmentProductResponseSchema.array().parse(await productsRes.json())
        allProducts.push(...page)
        if (allProducts.length > 5000) throw new Error("This assignment editor supports at most 5,000 products")
        if (page.length < 1000) break
      }
      if (requestId !== latestRequest.current) return
      const byId = new Map(allProducts.map(product => [product.id, product]))
      for (const product of assignData.data.enabledProductDetails) byId.set(product.id, product)
      const merged = [...byId.values()]
      setPartner(partnerData.data.partner)
      setProducts(merged)
      setCategories([...new Set(merged.map(product => product.category).filter((category): category is string => !!category))])
      setEnabledProducts(Object.fromEntries(assignData.data.products.map(product => [product.productId, product.enabled])))
    } catch (error) {
      if (requestId !== latestRequest.current) return
      setLoadFailed(true)
      setProducts([])
      setEnabledProducts({})
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false)
    }
  }

  const toggleProduct = (productId: string) => {
    if (!enabledProducts[productId] && products.find(product => product.id === productId)?.active === false) {
      toast.error("Inactive products cannot be enabled")
      return
    }
    setEnabledProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }))
  }

  const enableAll = () => {
    const updates: Record<string, boolean> = {}
    filteredProducts.forEach(p => {
      if (p.active !== false) updates[p.id] = true
    })
    setEnabledProducts(prev => ({ ...prev, ...updates }))
  }

  const disableAll = () => {
    const updates: Record<string, boolean> = {}
    filteredProducts.forEach(p => {
      updates[p.id] = false
    })
    setEnabledProducts(prev => ({ ...prev, ...updates }))
  }

  const saveChanges = async () => {
    if (loadFailed) return
    setIsSaving(true)
    try {
      const assignments = Object.entries(enabledProducts).map(([productId, enabled]) => ({
        productId,
        enabled
      }))

      const response = await apiFetch(`/api/admin/partners/${partnerId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: assignments }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Product assignments saved successfully')
        // refresh assignments/products to reflect saved state
        fetchData()
      } else {
        toast.error(data.error?.message || 'Failed to save')
      }
    } catch (error) {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.brand || product.manufacturerName)?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter

    const matchesEnabled = !showOnlyEnabled || enabledProducts[product.id]

    return matchesSearch && matchesCategory && matchesEnabled
  })

  const enabledCount = Object.values(enabledProducts).filter(Boolean).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {loadFailed && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">Assignments could not be loaded. Saving is disabled; refresh to retry.</p>}
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        These assignments are stored configuration. The current partner catalogue and checkout do not enforce product-specific access or custom pricing.
      </p>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/partners/${partnerId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Manage Products</h1>
          <p className="text-gray-600 mt-1">
            Configure product assignments for {partner?.name || 'Partner'}
          </p>
        </div>
        <button
          onClick={saveChanges}
          disabled={isSaving || loadFailed}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Total Active Products</p>
          <p className="text-2xl font-bold text-gray-900">{products.filter(p => p.active !== false).length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Enabled for Partner</p>
          <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Categories</p>
          <p className="text-2xl font-bold text-blue-600">{categories.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showOnlyEnabled}
              onChange={(e) => setShowOnlyEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Show Enabled Only</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={enableAll}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-green-50 text-green-600"
            >
              <Plus className="h-4 w-4" />
              Enable All
            </button>
            <button
              onClick={disableAll}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-red-50 text-red-600"
            >
              <Minus className="h-4 w-4" />
              Disable All
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid: split into Enabled and Pending lists */}
      <div className="space-y-6">
        {/* Enabled products */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Enabled for Partner</h3>
              <p className="text-sm text-gray-500">{Object.values(enabledProducts).filter(Boolean).length} products</p>
            </div>
            <div className="text-sm text-gray-600">Showing results for current filters</div>
          </div>

          {filteredProducts.filter(p => !!enabledProducts[p.id]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Package className="h-12 w-12 mb-4" />
              <p>No enabled products match the filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredProducts.filter(p => !!enabledProducts[p.id]).map((product, index) => {
                const productId = product.id
                return (
                  <div
                    key={`enabled-${productId}-${index}`}
                    className={`border rounded-lg p-4 cursor-pointer transition-all border-green-500 bg-green-50`}
                    onClick={() => toggleProduct(productId)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleProduct(productId); }}
                        className={`p-2 rounded-full bg-green-500 text-white`}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">{product.name}</h4>
                    <p className="text-xs text-gray-500 mb-2">{product.sku || 'No SKU'} • {product.brand || product.manufacturerName || 'No Brand'}</p>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900">₹{product.price?.toLocaleString()}</p>
                      {product.stock !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending / available products */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Pending / Available Products</h3>
              <p className="text-sm text-gray-500">{filteredProducts.filter(p => !enabledProducts[p.id]).length} products available to enable</p>
            </div>
            <div className="text-sm text-gray-600">Click a product to enable for this partner</div>
          </div>

          {filteredProducts.filter(p => !enabledProducts[p.id]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Package className="h-12 w-12 mb-4" />
              <p>No available products match the filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredProducts.filter(p => !enabledProducts[p.id]).map((product, index) => {
                const productId = product.id
                return (
                  <div
                    key={`pending-${productId}-${index}`}
                    className={`border rounded-lg p-4 cursor-pointer transition-all border-gray-200 hover:border-gray-300`}
                    onClick={() => toggleProduct(productId)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleProduct(productId); }}
                        className={`p-2 rounded-full bg-gray-200 text-gray-600`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">{product.name}</h4>
                    <p className="text-xs text-gray-500 mb-2">{product.sku || 'No SKU'} • {product.brand || product.manufacturerName || 'No Brand'}</p>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900">₹{product.price?.toLocaleString()}</p>
                      {product.stock !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      {Object.keys(enabledProducts).length > 0 && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={saveChanges}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                Save Changes ({enabledCount} enabled)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
