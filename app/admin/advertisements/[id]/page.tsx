"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
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
  order: number
}

export default function ViewAdvertisementPage({ params }: { params: { id: string } }) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [advertisement, setAdvertisement] = useState<Advertisement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Redirect if not admin
    if (user && !isAdmin) {
      router.push("/login")
      return
    }

    const fetchAdvertisement = async () => {
      try {
        setIsLoading(true)
        const response = await apiFetch(`/api/advertisements/${params.id}`)

        if (!response.ok) {
          throw new Error("Failed to fetch advertisement")
        }

        const data = await response.json()
        setAdvertisement(data)
        setError(null)
      } catch (error) {
        console.error("Error fetching advertisement:", error)
        setError("Failed to load advertisement. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAdvertisement()
  }, [params.id, user, isAdmin, router])

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this advertisement?")) {
      return
    }

    try {
      const response = await apiFetch(`/api/advertisements/${params.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete advertisement")
      }

      router.push("/admin/advertisements")
    } catch (error) {
      console.error("Error deleting advertisement:", error)
      setError("Failed to delete advertisement")
    }
  }

  // Parse description into bullet points
  const parseDescriptionPoints = (description: string) => {
    // Split by pipe character if it exists, otherwise assume it's a single point
    if (description.includes("|")) {
      return description
        .split("|")
        .map((point) => point.trim())
        .filter(Boolean)
    }

    // Alternative: split by newlines if they exist
    if (description.includes("\n")) {
      return description
        .split("\n")
        .map((point) => point.trim())
        .filter(Boolean)
    }

    // If no delimiter found, treat as a single point
    return [description]
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-800"></div>
        </div>
      </div>
    )
  }

  if (!advertisement) {
    return (
      <div className="p-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={() => router.push("/admin/advertisements")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Advertisement Not Found</h1>
        </div>
        <Card className="p-6">
          <p className="text-gray-500">The advertisement you are looking for does not exist or has been deleted.</p>
          <Button onClick={() => router.push("/admin/advertisements")} className="mt-4">
            Return to Advertisements
          </Button>
        </Card>
      </div>
    )
  }

  const descriptionPoints = parseDescriptionPoints(advertisement.description)

  return (
    <div className="p-8">
      <div className="flex items-center mb-8">
        <Button variant="ghost" onClick={() => router.push("/admin/advertisements")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">View Advertisement</h1>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="grid gap-6">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">{advertisement.title}</h2>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => router.push(`/admin/advertisements/${params.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="mb-6">
                <Label className="text-sm text-gray-500 block mb-1">Status</Label>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${advertisement.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                >
                  {advertisement.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mb-6">
                <Label className="text-sm text-gray-500 block mb-1">Description</Label>
                <div className="space-y-2">
                  {descriptionPoints.map((point, index) => (
                    <div key={index} className="flex items-start">
                      <div className="h-5 w-5 rounded-full bg-maroon-100 text-maroon-800 flex items-center justify-center mr-2 mt-0.5 text-xs">
                        {index + 1}
                      </div>
                      <p>{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label className="text-sm text-gray-500 block mb-1">Button Text</Label>
                  <p>{advertisement.buttonText}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500 block mb-1">Button Link</Label>
                  <p>{advertisement.buttonLink}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label className="text-sm text-gray-500 block mb-1">Background Color</Label>
                  <div className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded mr-2 ${advertisement.bgColor}`}
                      style={{ backgroundColor: advertisement.bgColor.startsWith("bg-") ? "" : advertisement.bgColor }}
                    ></div>
                    <p>{advertisement.bgColor}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-500 block mb-1">Text Color</Label>
                  <div className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded mr-2 ${advertisement.textColor}`}
                      style={{
                        backgroundColor: advertisement.textColor.startsWith("text-") ? "" : advertisement.textColor,
                      }}
                    ></div>
                    <p>{advertisement.textColor}</p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-500 block mb-1">Display Order</Label>
                <p>{advertisement.order}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm text-gray-500 block mb-2">Advertisement Image</Label>
              <div className="rounded-lg overflow-hidden border bg-gray-50 aspect-video">
                <img
                  src={advertisement.image || "/placeholder.svg?height=400&width=600"}
                  alt={advertisement.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    ;
(e.target as HTMLImageElement).src = "/placeholder.svg?height=400&width=600"
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Preview</h2>
          <div className={`${advertisement.bgColor} ${advertisement.textColor} rounded-lg p-6`}>
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-6 md:mb-0 md:pr-8">
                <h3 className="text-2xl font-bold mb-4">{advertisement.title}</h3>
                <div className="space-y-3 mb-6">
                  {descriptionPoints.map((point, index) => (
                    <div key={index} className="flex items-start">
                      <div className="h-5 w-5 rounded-full bg-white bg-opacity-20 flex items-center justify-center mr-2 mt-0.5 text-xs">
                        ✓
                      </div>
                      <p>{point}</p>
                    </div>
                  ))}
                </div>
                <button className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium">
                  {advertisement.buttonText}
                </button>
              </div>
              <div className="md:w-1/2">
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={advertisement.image || "/placeholder.svg?height=300&width=500"}
                    alt={advertisement.title}
                    className="w-full h-64 object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=300&width=500"
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
