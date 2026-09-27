"use client"


import type React from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { apiFetch } from "@/lib/api-client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, Eye } from "lucide-react"

interface ProductAdvertisementForm {
  title: string
  subtitle: string
  description: string
  image: string
  ctaText: string
  ctaLink: string
  backgroundColor: string
  textColor: string
  overlayOpacity: number
  isActive: boolean
  order: number
}

export default function EditProductAdvertisementPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const lock = useSubmitLock()
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const [formData, setFormData] = useState<ProductAdvertisementForm>({
    title: "",
    subtitle: "",
    description: "",
    image: "",
    ctaText: "Shop Now",
    ctaLink: "/products",
    backgroundColor: "#1f2937",
    textColor: "#ffffff",
    overlayOpacity: 50,
    isActive: true,
    order: 1,
  })

  useEffect(() => {
    fetchAdvertisement()
  }, [params.id])

  const fetchAdvertisement = async () => {
    try {
      setIsFetching(true)
      const response = await apiFetch(`/api/product-advertisements/${params.id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch advertisement")
      }

      const data = await response.json()
      setFormData({
        title: data.title || "",
        subtitle: data.subtitle || "",
        description: data.description || "",
        image: data.image || "",
        ctaText: data.ctaText || "Shop Now",
        ctaLink: data.ctaLink || "/products",
        backgroundColor: data.backgroundColor || "#1f2937",
        textColor: data.textColor || "#ffffff",
        overlayOpacity: data.overlayOpacity || 50,
        isActive: data.isActive !== undefined ? data.isActive : true,
        order: data.order || 1,
      })
    } catch (err) {
      console.error("Error fetching advertisement:", err)
      setError(err instanceof Error ? err.message : "Failed to load advertisement")
    } finally {
      setIsFetching(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : type === "number" ? Number(value) : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock.acquire()) return
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiFetch(`/api/product-advertisements/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update advertisement")
      }

      router.push("/admin/product-advertisements")
    } catch (err) {
      console.error("Error updating advertisement:", err)
      setError(err instanceof Error ? err.message : "Failed to update advertisement")
    } finally {
      lock.release()
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-gray-200 h-96 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/admin/product-advertisements">
            <button className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Product Advertisement</h1>
            <p className="text-gray-600 mt-1">Update the hero slider advertisement</p>
          </div>
        </div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors inline-flex items-center"
        >
          <Eye className="h-4 w-4 mr-2" />
          {showPreview ? "Hide Preview" : "Show Preview"}
        </button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter advertisement title"
                  />
                </div>

                <div>
                  <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    id="subtitle"
                    name="subtitle"
                    value={formData.subtitle}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter subtitle (optional)"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter description (optional)"
                  />
                </div>

                <div>
                  <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
                    Background Image URL *
                  </label>
                  <input
                    type="url"
                    id="image"
                    name="image"
                    value={formData.image}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Call to Action</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="ctaText" className="block text-sm font-medium text-gray-700 mb-1">
                    Button Text
                  </label>
                  <input
                    type="text"
                    id="ctaText"
                    name="ctaText"
                    value={formData.ctaText}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Shop Now"
                  />
                </div>

                <div>
                  <label htmlFor="ctaLink" className="block text-sm font-medium text-gray-700 mb-1">
                    Button Link
                  </label>
                  <input
                    type="text"
                    id="ctaLink"
                    name="ctaLink"
                    value={formData.ctaLink}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="/products"
                  />
                </div>
              </div>
            </div>

            {/* Styling */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Styling</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="backgroundColor" className="block text-sm font-medium text-gray-700 mb-1">
                      Background Color
                    </label>
                    <input
                      type="color"
                      id="backgroundColor"
                      name="backgroundColor"
                      value={formData.backgroundColor}
                      onChange={handleInputChange}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label htmlFor="textColor" className="block text-sm font-medium text-gray-700 mb-1">
                      Text Color
                    </label>
                    <input
                      type="color"
                      id="textColor"
                      name="textColor"
                      value={formData.textColor}
                      onChange={handleInputChange}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="overlayOpacity" className="block text-sm font-medium text-gray-700 mb-1">
                    Overlay Opacity: {formData.overlayOpacity}%
                  </label>
                  <input
                    type="range"
                    id="overlayOpacity"
                    name="overlayOpacity"
                    min="0"
                    max="100"
                    value={formData.overlayOpacity}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Settings</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      id="order"
                      name="order"
                      min="1"
                      value={formData.order}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                      Active (visible on website)
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Link href="/admin/product-advertisements">
                <button
                  type="button"
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Updating..." : "Update Advertisement"}
              </button>
            </div>
          </form>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Preview</h3>
            <div className="relative h-64 rounded-lg overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: formData.image ? `url(${formData.image})` : "none",
                  backgroundColor: formData.backgroundColor,
                }}
              >
                <div className="absolute inset-0 bg-black" style={{ opacity: formData.overlayOpacity / 100 }}></div>
                <div className="relative h-full flex items-center justify-center text-center p-8">
                  <div style={{ color: formData.textColor }}>
                    {formData.title && <h2 className="text-2xl font-bold mb-2">{formData.title}</h2>}
                    {formData.subtitle && <p className="text-lg mb-2">{formData.subtitle}</p>}
                    {formData.description && <p className="text-sm mb-4">{formData.description}</p>}
                    {formData.ctaText && (
                      <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        {formData.ctaText}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
