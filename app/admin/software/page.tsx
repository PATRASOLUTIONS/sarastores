'use client'


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Key, Package } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface SoftwareProduct {
  _id: string
  name: string
  category: string
  status: string
  totalKeysAvailable: number
  totalKeysAssigned: number
  pricing: {
    pack1: number
  }
}

export default function AdminSoftwarePage() {
  const [products, setProducts] = useState<SoftwareProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [availableKeysTotal, setAvailableKeysTotal] = useState<number | null>(null)
  const [assignedKeysTotal, setAssignedKeysTotal] = useState<number | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await apiFetch('/api/software')
      const data = await response.json()
      if (data.success) {
        setLastUpdated(new Date())

        // Enrich products with realtime per-product available/assigned key counts
        const prods: SoftwareProduct[] = data.products
        const enriched = await Promise.all(
          prods.map(async (p: any) => {
            try {
              const [availRes, assignedRes] = await Promise.all([
                apiFetch(`/api/software/license-keys?softwareId=${encodeURIComponent(p._id)}&status=available`),
                apiFetch(`/api/software/license-keys?softwareId=${encodeURIComponent(p._id)}&status=assigned`),
              ])
              const availJson = await availRes.json()
              const assignedJson = await assignedRes.json()
              const availCount = availJson.success && Array.isArray(availJson.keys) ? availJson.keys.length : p.totalKeysAvailable || 0
              const assignedCount = assignedJson.success && Array.isArray(assignedJson.keys) ? assignedJson.keys.length : p.totalKeysAssigned || 0
              return {
                ...p,
                totalKeysAvailable: availCount,
                totalKeysAssigned: assignedCount,
              }
            } catch (e) {
              console.warn('Failed to fetch key counts for product', p._id, e)
              return p
            }
          })
        )

        setProducts(enriched)

        // update global totals from enriched data
        const totalAvail = enriched.reduce((s, x) => s + (x.totalKeysAvailable || 0), 0)
        const totalAssigned = enriched.reduce((s, x) => s + (x.totalKeysAssigned || 0), 0)
        setAvailableKeysTotal(totalAvail)
        setAssignedKeysTotal(totalAssigned)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  // Poll for real-time updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this software product?')) {
      return
    }

    try {
      const response = await apiFetch(`/api/software/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Product deleted successfully')
        fetchProducts()
      } else {
        toast.error(data.error || 'Failed to delete product')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Failed to delete product')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Software Products</h1>
          <p className="text-gray-600 mt-1">Manage your software licenses and keys</p>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">Live • Last updated {new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastUpdated)}</p>
          )}
        </div>
        <Link
          href="/admin/software/new"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Software
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Products</p>
              <p className="text-3xl font-bold mt-1">{products.length}</p>
            </div>
            <Package className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Products</p>
              <p className="text-3xl font-bold mt-1">
                {products.filter(p => p.status === 'active').length}
              </p>
            </div>
            <Package className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Available Keys</p>
              <p className="text-3xl font-bold mt-1">
                {availableKeysTotal ?? products.reduce((sum, p) => sum + p.totalKeysAvailable, 0)}
              </p>
            </div>
            <Key className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Assigned Keys</p>
              <p className="text-3xl font-bold mt-1">
                {assignedKeysTotal ?? products.reduce((sum, p) => sum + p.totalKeysAssigned, 0)}
              </p>
            </div>
            <Key className="w-12 h-12 text-orange-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Available Keys
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned Keys
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Base Price
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No software products found. Create your first one!
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{product.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">{product.category}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        product.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : product.status === 'inactive'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-purple-600">
                      {product.totalKeysAvailable}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-orange-600">
                      {product.totalKeysAssigned}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold">
                      ₹{product.pricing.pack1.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/software/${product._id}/keys`}
                        className="text-purple-600 hover:text-purple-900"
                        title="Manage Keys"
                      >
                        <Key className="w-5 h-5" />
                      </Link>
                      <Link
                        href={`/admin/software/${product._id}/edit`}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => deleteProduct(product._id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
