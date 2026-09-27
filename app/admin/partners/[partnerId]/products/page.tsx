"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, use } from "react"
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

interface Product {
  _id: string;

  id: string;
  name: string;
  sku?: string;
  price: number;
  mrp?: number;
  category?: string;
  subCategory?: string;
  brand?: string;
  manufacturerName?: string;
  stock?: number;
  images?: string[];
  active?: boolean;
}

interface Partner {
  id: string;
  name: string;
  tier: string;
}

interface PartnerProduct {
  productId: string;
  customPrice?: number;
  customCommission?: number;
  enabled: boolean;
}

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

  useEffect(() => {
    fetchData()
  }, [partnerId])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch partner details
      const partnerRes = await apiFetch(`/api/admin/partners/${partnerId}`)
      const partnerData = await partnerRes.json()
      if (partnerData.success) {
        setPartner(partnerData.data.partner)
      }

      // Fetch active products only for partner assignment view
      const productsRes = await apiFetch(`/api/products`)
      const productsData = await productsRes.json()

      // API returns array directly, not wrapped in success/data
      const allProducts = Array.isArray(productsData)
        ? productsData
        : (productsData.data?.products || productsData.products || [])

      // Normalize product IDs to strings and ensure unique IDs
      const normalizedProducts = allProducts
        .map((p: any, index: number) => {
          // The API uses normalizeId() which renames _id -> id
          const stringId = p.id || (p._id ? (typeof p._id === 'object' ? p._id.toString() : String(p._id)) : null)

          if (!stringId) {
            console.warn(`[Manage Products] Product at index ${index} has no ID!`, p.name)
            return null
          }

          return {
            ...p,
            id: stringId,
            _id: stringId,
          }
        })
        .filter(Boolean) as Product[]

      setProducts(normalizedProducts)

      // Extract unique categories
      const cats = [...new Set(normalizedProducts.map((p: Product) => p.category).filter(Boolean))] as string[]
      setCategories(cats)

      // Fetch partner product assignments with cache breaker
      const assignRes = await apiFetch(`/api/admin/partners/${partnerId}/products?t=${Date.now()}`)
      const assignData = await assignRes.json()
      if (assignData.success) {
        const assignments = assignData.data.products || []
        console.log('[Manage Products] Fetched assignments:', assignments.length)
        const enabledMap: Record<string, boolean> = {}
        assignments.forEach((p: PartnerProduct) => {
          // Normalize productId keys we may receive (trim, and unwrap ObjectId(...) wrappers)
          const raw = String(p.productId || '').trim()
          if (!raw) return
          const unwrapped = raw.replace(/^ObjectId\(\"(.*)\"\)$/, '$1')
          // Prefer the unwrapped canonical id when available, otherwise use the raw string
          const pid = unwrapped || raw
          enabledMap[pid] = !!p.enabled
        })
        setEnabledProducts(enabledMap)

        // If the assignments API returned full product details for enabled products,
        // merge those into our products list so enabled items always display.
        const enabledDetails = assignData.data.enabledProductDetails || []
        if (Array.isArray(enabledDetails) && enabledDetails.length > 0) {
          const existingIds = new Set(normalizedProducts.map((p: Product) => p.id))
          const merged = [...normalizedProducts]
          enabledDetails.forEach((ed: any) => {
            const id = ed._id || ed.id
            if (!id) return
            const sid = String(id)
            if (!existingIds.has(sid)) {
              merged.push({
                ...ed,
                id: sid,
                _id: sid,
                price: ed.price || 0,
                mrp: ed.mrp || ed.price || 0,
                images: ed.images || (ed.image ? [ed.image] : []),
                active: ed.active !== false,
              })
              existingIds.add(sid)
            }
          })
          setProducts(merged)
          const mergedCats = [...new Set(merged.map((p: Product) => p.category).filter(Boolean))] as string[]
          setCategories(mergedCats)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleProduct = (productId: string) => {
    setEnabledProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }))
  }

  const enableAll = () => {
    const updates: Record<string, boolean> = {}
    filteredProducts.forEach(p => {
      updates[p._id] = true
    })
    setEnabledProducts(prev => ({ ...prev, ...updates }))
  }

  const disableAll = () => {
    const updates: Record<string, boolean> = {}
    filteredProducts.forEach(p => {
      updates[p._id] = false
    })
    setEnabledProducts(prev => ({ ...prev, ...updates }))
  }

  const saveChanges = async () => {
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

    const matchesEnabled = !showOnlyEnabled || enabledProducts[product._id]

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
            Configure product access for {partner?.name || 'Partner'}
          </p>
        </div>
        <button
          onClick={saveChanges}
          disabled={isSaving}
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

          {filteredProducts.filter(p => !!enabledProducts[p._id || p.id]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Package className="h-12 w-12 mb-4" />
              <p>No enabled products match the filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredProducts.filter(p => !!enabledProducts[p._id || p.id]).map((product, index) => {
                const productId = product._id || product.id
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
              <p className="text-sm text-gray-500">{filteredProducts.filter(p => !enabledProducts[p._id || p.id]).length} products available to enable</p>
            </div>
            <div className="text-sm text-gray-600">Click a product to enable for this partner</div>
          </div>

          {filteredProducts.filter(p => !enabledProducts[p._id || p.id]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Package className="h-12 w-12 mb-4" />
              <p>No available products match the filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredProducts.filter(p => !enabledProducts[p._id || p.id]).map((product, index) => {
                const productId = product._id || product.id
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
