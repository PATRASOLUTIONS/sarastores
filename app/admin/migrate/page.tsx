"use client"


import { apiFetch } from "@/lib/api-client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Database, ArrowRight, Check, AlertCircle } from "lucide-react"

export default function MigratePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleMigrate = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Collect all data from localStorage
      const localStorageData: Record<string, any> = {}
      const keys = [
        "products",
        "categories",
        "productReviews",
        "productAdvertisements",
        "productSlides",
        "heroSlides",
        "offerProducts",
        "popularProducts",
        "featuredProducts",
        "testimonials",
      ]

      for (const key of keys) {
        const data = localStorage.getItem(key)
        if (data) {
          try {
            localStorageData[key] = JSON.parse(data)
          } catch (e) {
            console.error(`Error parsing ${key} from localStorage:`, e)
          }
        }
      }

      // Send data to migration API
      const response = await apiFetch("/api/migrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(localStorageData),
      })

      if (!response.ok) {
        throw new Error("Failed to migrate data")
      }

      setSuccess(true)

      // Redirect after successful migration
      setTimeout(() => {
        router.push("/admin/dashboard")
      }, 3000)
    } catch (err) {
      console.error("Migration error:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Migrate to Database</h1>

      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
        <div className="flex items-center mb-6 text-blue-600">
          <Database className="h-8 w-8 mr-3" />
          <h2 className="text-xl font-semibold">Database Migration</h2>
        </div>

        <p className="mb-6 text-gray-600">
          This utility will migrate all your data from browser localStorage to MongoDB database. This is a one-time
          operation and will allow your data to persist across browsers and devices.
        </p>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Warning:</strong> This operation will overwrite any existing data in the database. Make sure you
                have a backup if needed.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  <strong>Error:</strong> {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <strong>Success!</strong> Your data has been successfully migrated to the database. You will be
                  redirected to the dashboard in a few seconds.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleMigrate}
          disabled={isLoading || success}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center disabled:bg-blue-400"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
              Migrating...
            </>
          ) : success ? (
            <>
              <Check className="h-5 w-5 mr-2" />
              Migration Complete
            </>
          ) : (
            <>
              Start Migration
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
