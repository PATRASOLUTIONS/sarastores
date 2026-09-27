"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Plus, Edit, Trash2, Eye, ArrowUpDown } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

interface Advertisement {
  id: string
  title: string
  description: string
  image: string
  buttonText: string
  buttonLink: string
  bgColor: string
  textColor: string
  active: boolean
  featured: boolean
  order: number
  category?: string // category id or name
}

interface Category {
  id: string
  name: string
}

export default function AdvertisementsPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (user && !isAdmin) {
      router.push("/login")
      return
    }

    fetchCategories()
    fetchAdvertisements()
  }, [user, isAdmin, router])

  const fetchCategories = async () => {
    try {
      const res = await apiFetch("/api/categories")
      const data = await res.json()
      setCategories(data)
    } catch (err) {
      console.error("Failed to fetch categories:", err)
    }
  }

  const fetchAdvertisements = async () => {
    try {
      setIsLoading(true)
      const response = await apiFetch("/api/advertisements")

      if (!response.ok) throw new Error("Failed to fetch advertisements")

      const data = await response.json()
      const sortedAds = [...data].sort((a, b) => a.order - b.order)
      setAdvertisements(sortedAds)
    } catch (error) {
      console.error("Error fetching advertisements:", error)
      setError("Failed to load advertisements. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAds = selectedCategory
    ? advertisements.filter((ad) => ad.category === selectedCategory)
    : advertisements

  const getCategoryName = (id: string | undefined) => {
    const cat = categories.find((c) => c.id === id)
    return cat ? cat.name : "Uncategorized"
  }

  const handleDeleteAdvertisement = async (id: string) => {
    if (!confirm("Delete this advertisement?")) return
    try {
      const res = await apiFetch(`/api/advertisements/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setAdvertisements((prev) => prev.filter((ad) => ad.id !== id))
      setSuccess("Advertisement deleted")
    } catch {
      setError("Could not delete the advertisement")
    }
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const res = await apiFetch(`/api/advertisements/${id}`, {
        method: "PUT",
        json: { active },
      })
      if (!res.ok) throw new Error()
      setAdvertisements((prev) => prev.map((ad) => (ad.id === id ? { ...ad, active } : ad)))
    } catch {
      setError("Could not update the advertisement")
    }
  }

  /** Order is persisted for both swapped rows so a reload keeps the new sequence. */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= advertisements.length) return

    const reordered = [...advertisements]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    const withOrder = reordered.map((ad, i) => ({ ...ad, order: i }))
    setAdvertisements(withOrder)

    try {
      await Promise.all(
        [withOrder[index], withOrder[target]].map((ad) =>
          apiFetch(`/api/advertisements/${ad.id}`, { method: "PUT", json: { order: ad.order } }),
        ),
      )
    } catch {
      setError("Could not save the new order")
      fetchAdvertisements()
    }
  }

  const handleMoveUp = (index: number) => move(index, -1)
  const handleMoveDown = (index: number) => move(index, 1)

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Advertisements</h1>
        <Button onClick={() => router.push("/admin/advertisements/new")} className="bg-maroon-800 hover:bg-maroon-900">
          <Plus className="h-4 w-4 mr-2" />
          Add New Advertisement
        </Button>
      </div>

      {/* 🔽 Category Filter Dropdown */}
      <div className="mb-6">
        <Label htmlFor="categoryFilter" className="block mb-2">
          Filter by Category
        </Label>
        <select
          id="categoryFilter"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border rounded-md px-3 py-2 w-full md:w-1/3"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-100 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-800"></div>
        </div>
      ) : filteredAds.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500 mb-4">No advertisements found.</p>
          <Button onClick={() => router.push("/admin/advertisements/new")} className="bg-maroon-800 hover:bg-maroon-900">
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Advertisement
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredAds.map((ad, index) => (
            <Card key={ad.id} className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/4">
                  <img
                    src={ad.image || "/placeholder.svg"}
                    alt={ad.title}
                    className="w-full aspect-video object-cover rounded-md bg-gray-100"
                    onError={(e) => ((e.target as HTMLImageElement).src = "/placeholder.svg")}
                  />
                </div>
                <div className="md:w-3/4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-semibold">{ad.title}</h2>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ad.description}</p>
                      {/* 👇 Show category */}
                      <p className="text-xs text-gray-400 mt-1">
                        Category: <span className="font-medium">{getCategoryName(ad.category)}</span>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`active-${ad.id}`}
                        checked={ad.active}
                        onCheckedChange={() => handleToggleActive(ad.id, ad.active)}
                      />
                      <span className={ad.active ? "text-green-600" : "text-gray-400"}>
                        {ad.active ? "Active" : "Inactive"}
                      </span>
                      {ad.featured && (
                        <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>

                  {/* existing grid for buttonText, buttonLink, bgColor, textColor... */}

                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleMoveUp(index)} disabled={index === 0}>
                        <ArrowUpDown className="h-4 w-4 mr-1" />
                        Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === filteredAds.length - 1}
                      >
                        <ArrowUpDown className="h-4 w-4 mr-1" />
                        Down
                      </Button>
                      <span className="text-sm text-gray-500">Order: {ad.order}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => router.push(`/admin/advertisements/${ad.id}`)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/advertisements/${ad.id}/edit`)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-white hover:bg-red-600"
                        onClick={() => handleDeleteAdvertisement(ad.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
