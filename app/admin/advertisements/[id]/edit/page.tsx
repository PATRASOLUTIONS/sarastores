"use client"


import type React from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
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
  category: string
}

interface Category {
  id: string
  name: string
}

export default function EditAdvertisementPage({ params }: { params: { id: string } }) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const lock = useSubmitLock()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  const [formData, setFormData] = useState<Advertisement>({
    id: params.id,
    title: "",
    description: "",
    image: "",
    buttonText: "",
    buttonLink: "",
    bgColor: "",
    textColor: "",
    active: true,
    featured: false,
    order: 0,
    category: "",
  })

  useEffect(() => {
    if (user && !isAdmin) {
      router.push("/login")
      return
    }

    const fetchAdvertisement = async () => {
      try {
        const res = await apiFetch(`/api/advertisements/${params.id}`)
        const data = await res.json()
        setFormData(data)
      } catch (err) {
        console.error("Error fetching advertisement:", err)
        setError("Failed to load advertisement. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    const fetchCategories = async () => {
      try {
        const res = await apiFetch("/api/categories")
        const data = await res.json()
        setCategories(data)
      } catch (err) {
        console.error("Error fetching categories:", err)
      }
    }

    fetchAdvertisement()
    fetchCategories()
  }, [params.id, user, isAdmin, router])

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
      const res = await apiFetch(`/api/advertisements/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error("Failed to update advertisement")

      router.push("/admin/advertisements")
    } catch (err) {
      console.error("Error updating advertisement:", err)
      setError("Failed to update advertisement. Please try again.")
    } finally {
      lock.release()
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-800"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center mb-8">
        <Button variant="ghost" onClick={() => router.push("/admin/advertisements")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Edit Advertisement</h1>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <Card className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 mb-6">
            {/* Title & Image */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="image">Image URL</Label>
                <Input id="image" name="image" value={formData.image} onChange={handleChange} />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            {/* Button Text & Link */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="buttonText">Button Text</Label>
                <Input id="buttonText" name="buttonText" value={formData.buttonText} onChange={handleChange} required />
              </div>
              <div>
                <Label htmlFor="buttonLink">Button Link</Label>
                <Input id="buttonLink" name="buttonLink" value={formData.buttonLink} onChange={handleChange} required />
              </div>
            </div>

            {/* Background & Text Color */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="bgColor">Background Color</Label>
                <Input id="bgColor" name="bgColor" value={formData.bgColor} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="textColor">Text Color</Label>
                <Input id="textColor" name="textColor" value={formData.textColor} onChange={handleChange} />
              </div>
            </div>

            {/* Category Dropdown */}
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Switches */}
            <div className="flex items-center space-x-2">
              <Switch id="active" checked={formData.active} onCheckedChange={handleSwitchChange} />
              <Label htmlFor="active">Active</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="featured" checked={formData.featured} onCheckedChange={handleFeaturedChange} />
              <Label htmlFor="featured">Featured</Label>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/advertisements")}
              className="mr-2"
              disabled={isSubmitting}
            >
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
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
