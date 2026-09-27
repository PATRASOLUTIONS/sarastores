"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Edit, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react"

interface ProductAdvertisement {
  _id: string
  title: string
  subtitle?: string
  description?: string
  image: string
  ctaText?: string
  ctaLink?: string
  backgroundColor?: string
  textColor?: string
  overlayOpacity?: number
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export default function ProductAdvertisementsPage() {
  const [advertisements, setAdvertisements] = useState<ProductAdvertisement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAds, setSelectedAds] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    fetchAdvertisements()
  }, [])

  const fetchAdvertisements = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch("/api/product-advertisements")

      if (!response.ok) {
        throw new Error("Failed to fetch advertisements")
      }

      const data = await response.json()
      setAdvertisements(data)
    } catch (err) {
      console.error("Error fetching advertisements:", err)
      setError(err instanceof Error ? err.message : "Failed to load advertisements")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const advertisement = advertisements.find((ad) => ad._id === id)
      if (!advertisement) return

      const response = await apiFetch(`/api/product-advertisements/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...advertisement,
          isActive: !currentStatus,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update advertisement")
      }

      await fetchAdvertisements()
    } catch (err) {
      console.error("Error updating advertisement:", err)
      alert("Failed to update advertisement status")
    }
  }

  const deleteAdvertisement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this advertisement?")) {
      return
    }

    try {
      const response = await apiFetch(`/api/product-advertisements/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete advertisement")
      }

      await fetchAdvertisements()
    } catch (err) {
      console.error("Error deleting advertisement:", err)
      alert("Failed to delete advertisement")
    }
  }

  const deleteSelected = async () => {
    if (selectedAds.length === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedAds.length} advertisement(s)?`)) {
      return
    }

    try {
      await Promise.all(selectedAds.map((id) => apiFetch(`/api/product-advertisements/${id}`, { method: "DELETE" })))

      setSelectedAds([])
      await fetchAdvertisements()
    } catch (err) {
      console.error("Error deleting advertisements:", err)
      alert("Failed to delete selected advertisements")
    }
  }

  const updateOrder = async (id: string, newOrder: number) => {
    try {
      const advertisement = advertisements.find((ad) => ad._id === id)
      if (!advertisement) return

      const response = await apiFetch(`/api/product-advertisements/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...advertisement,
          order: newOrder,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update order")
      }

      await fetchAdvertisements()
    } catch (err) {
      console.error("Error updating order:", err)
      alert("Failed to update advertisement order")
    }
  }

  const moveUp = (id: string) => {
    const ad = advertisements.find((a) => a._id === id)
    if (!ad || ad.order <= 1) return
    updateOrder(id, ad.order - 1)
  }

  const moveDown = (id: string) => {
    const ad = advertisements.find((a) => a._id === id)
    const maxOrder = Math.max(...advertisements.map((a) => a.order))
    if (!ad || ad.order >= maxOrder) return
    updateOrder(id, ad.order + 1)
  }

  const toggleSelectAll = () => {
    if (selectedAds.length === advertisements.length) {
      setSelectedAds([])
    } else {
      setSelectedAds(advertisements.map((ad) => ad._id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedAds((prev) => (prev.includes(id) ? prev.filter((adId) => adId !== id) : [...prev, id]))
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Advertisements</h1>
          <p className="text-gray-600 mt-1">Manage hero slider advertisements for the products page</p>
        </div>
        <Link href="/admin/product-advertisements/new">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Add New Advertisement
          </button>
        </Link>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

      {selectedAds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-blue-800">{selectedAds.length} advertisement(s) selected</span>
            <button
              onClick={deleteSelected}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors inline-flex items-center"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedAds.length === advertisements.length && advertisements.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preview
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {advertisements.map((ad) => (
              <tr key={ad._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedAds.includes(ad._id)}
                    onChange={() => toggleSelect(ad._id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-6 py-4">
                  <img src={ad.image || "/placeholder.svg"} alt={ad.title} className="h-12 w-20 object-cover rounded" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{ad.title}</div>
                    {ad.subtitle && <div className="text-sm text-gray-500">{ad.subtitle}</div>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleActive(ad._id, ad.isActive)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      ad.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {ad.isActive ? (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm text-gray-900">{ad.order}</span>
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveUp(ad._id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        disabled={ad.order <= 1}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveDown(ad._id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        disabled={ad.order >= Math.max(...advertisements.map((a) => a.order))}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(ad.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm font-medium">
                  <div className="flex space-x-2">
                    <Link href={`/admin/product-advertisements/${ad._id}/edit`}>
                      <button className="text-blue-600 hover:text-blue-900">
                        <Edit className="h-4 w-4" />
                      </button>
                    </Link>
                    <button onClick={() => deleteAdvertisement(ad._id)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {advertisements.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">No advertisements found</div>
            <Link href="/admin/product-advertisements/new">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Create Your First Advertisement
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
