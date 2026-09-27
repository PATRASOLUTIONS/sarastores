"use client"


import type React from "react"
import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

interface Category {
  _id: string
  name: string
}

export default function NewAdvertisementPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lock = useSubmitLock()
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image: "",
    buttonText: "Learn More",
    buttonLink: "/products",
    bgColor: "bg-maroon-800",
    textColor: "text-white",
    category: "",
    active: true,
    featured: false,
    order: 0,
  })

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiFetch("/api/categories") // Adjust your API route as necessary
        const data = await res.json()
        setCategories(data)
      } catch (err) {
        console.error("Failed to fetch categories:", err)
      }
    }

    fetchCategories()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, active: checked }))
  }

  const handleFeaturedChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, featured: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock.acquire()) return
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await apiFetch("/api/advertisements")
      const existingAds = await response.json()
      const highestOrder = existingAds.length > 0 ? Math.max(...existingAds.map((ad: any) => ad.order)) : -1

      const dataToSubmit = {
        ...formData,
        order: highestOrder + 1,
      }

      const createResponse = await apiFetch("/api/advertisements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSubmit),
      })

      if (!createResponse.ok) {
        throw new Error("Failed to create advertisement")
      }

      router.push("/admin/advertisements")
    } catch (error) {
      console.error("Error creating advertisement:", error)
      setError("Failed to create advertisement. Please try again.")
    } finally {
      lock.release()
      setIsSubmitting(false)
    }
  }

  if (user && !isAdmin) {
    router.push("/login")
    return null
  }

  return (
    <div className="p-8">
      <div className="flex items-center mb-8">
        <Button variant="ghost" onClick={() => router.push("/admin/advertisements")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Create New Advertisement</h1>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <Card className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="image">Image URL</Label>
                <Input id="image" name="image" value={formData.image} onChange={handleChange} />
                <p className="text-xs text-gray-500 mt-1">Enter a URL for the advertisement image</p>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">Use | to separate bullet points</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="buttonText">Button Text</Label>
                <Input id="buttonText" name="buttonText" value={formData.buttonText} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="buttonLink">Button Link</Label>
                <Input id="buttonLink" name="buttonLink" value={formData.buttonLink} onChange={handleChange} required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="bgColor">Background Color</Label>
                <select id="bgColor" name="bgColor" value={formData.bgColor} onChange={handleChange} required className="form-select w-full border px-3 py-2 rounded-md">
                  <option value="bg-maroon-800">Maroon</option>
                  <option value="bg-blue-600">Blue</option>
                  <option value="bg-green-600">Green</option>
                  <option value="bg-purple-600">Purple</option>
                  <option value="bg-red-600">Red</option>
                  <option value="bg-yellow-500">Yellow</option>
                  <option value="bg-gray-800">Dark Gray</option>
                  <option value="bg-gray-200">Light Gray</option>
                  <option value="#1a365d">Custom Navy</option>
                  <option value="#7c3aed">Custom Purple</option>
                  <option value="#047857">Custom Emerald</option>
                </select>
              </div>
              <div>
                <Label htmlFor="textColor">Text Color</Label>
                <Input id="textColor" name="textColor" value={formData.textColor} onChange={handleChange} required />
              </div>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="form-select w-full border px-3 py-2 rounded-md"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="active" checked={formData.active} onCheckedChange={handleSwitchChange} />
              <Label htmlFor="active">Active</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="featured" checked={formData.featured} onCheckedChange={handleFeaturedChange} />
              <Label htmlFor="featured">Featured</Label>
              <span className="text-xs text-gray-500 ml-2">(Featured advertisements will be highlighted)</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/advertisements")} className="mr-2" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-maroon-800 hover:bg-maroon-900" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Advertisement
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
