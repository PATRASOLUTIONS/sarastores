'use client'


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from 'react'
import { useSubmitLock } from '@/hooks/useSubmitLock'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface SoftwareProduct {
  _id: string
  name: string
  description: string
  shortDescription: string
  category: string
  image: string
  features: string[]
  systemRequirements: {
    os: string[]
    processor: string
    ram: string
    storage: string
  }
  pricing: {
    pack1: number
    pack2: number
    pack3: number
    pack4: number
    pack5: number
  }
  validityPeriods: {
    oneYear: number
    twoYear: number
    threeYear: number
    fourYear: number
    fiveYear: number
  }
  status: string
}

export default function EditSoftwarePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const lock = useSubmitLock()
  const [formData, setFormData] = useState<SoftwareProduct>({
    _id: '',
    name: '',
    description: '',
    shortDescription: '',
    category: '',
    image: '',
    features: [''],
    systemRequirements: {
      os: [''],
      processor: '',
      ram: '',
      storage: '',
    },
    pricing: {
      pack1: 0,
      pack2: 0,
      pack3: 0,
      pack4: 0,
      pack5: 0,
    },
    validityPeriods: {
      oneYear: 0,
      twoYear: 0,
      threeYear: 0,
      fourYear: 0,
      fiveYear: 0,
    },
    status: 'active',
  })

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const response = await apiFetch(`/api/software/${id}`)
      const data = await response.json()
      
      if (data.success) {
        setFormData(data.product)
      } else {
        toast.error('Failed to load product')
        router.push('/admin/software')
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      toast.error('Failed to load product')
      router.push('/admin/software')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock.acquire()) return
    setSaving(true)

    try {
      const response = await apiFetch(`/api/software/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Software product updated successfully!')
        router.push('/admin/software')
      } else {
        toast.error(data.error || 'Failed to update product')
      }
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error('Failed to update product')
    } finally {
      lock.release()
      setSaving(false)
    }
  }

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, ''],
    })
  }

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    })
  }

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features]
    newFeatures[index] = value
    setFormData({ ...formData, features: newFeatures })
  }

  const addOS = () => {
    setFormData({
      ...formData,
      systemRequirements: {
        ...formData.systemRequirements,
        os: [...formData.systemRequirements.os, ''],
      },
    })
  }

  const removeOS = (index: number) => {
    setFormData({
      ...formData,
      systemRequirements: {
        ...formData.systemRequirements,
        os: formData.systemRequirements.os.filter((_, i) => i !== index),
      },
    })
  }

  const updateOS = (index: number, value: string) => {
    const newOS = [...formData.systemRequirements.os]
    newOS[index] = value
    setFormData({
      ...formData,
      systemRequirements: {
        ...formData.systemRequirements,
        os: newOS,
      },
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/software"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Software
        </Link>
        <h1 className="text-3xl font-bold">Edit Software Product</h1>
        <p className="text-gray-600 mt-1">Update software product details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Operating System, Office Suite, Antivirus"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Short Description *
              </label>
              <input
                type="text"
                required
                value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief one-line description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Description *
              </label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Detailed product description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL *
              </label>
              <input
                type="url"
                required
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Features</h2>
          <div className="space-y-3">
            {formData.features.map((feature, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={feature}
                  onChange={(e) => updateFeature(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter feature"
                />
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addFeature}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Feature
            </button>
          </div>
        </div>

        {/* System Requirements */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">System Requirements</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operating Systems
              </label>
              <div className="space-y-2">
                {formData.systemRequirements.os.map((os, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={os}
                      onChange={(e) => updateOS(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Windows 10/11"
                    />
                    <button
                      type="button"
                      onClick={() => removeOS(index)}
                      className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOS}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add OS
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Processor *
              </label>
              <input
                type="text"
                required
                value={formData.systemRequirements.processor}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    systemRequirements: {
                      ...formData.systemRequirements,
                      processor: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Intel Core i3 or equivalent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RAM *
              </label>
              <input
                type="text"
                required
                value={formData.systemRequirements.ram}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    systemRequirements: {
                      ...formData.systemRequirements,
                      ram: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 4GB minimum"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Storage *
              </label>
              <input
                type="text"
                required
                value={formData.systemRequirements.storage}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    systemRequirements: {
                      ...formData.systemRequirements,
                      storage: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 20GB available space"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Pricing (Base Price per Pack Size)</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((pack) => (
              <div key={pack}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pack {pack} *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.pricing[`pack${pack}` as keyof typeof formData.pricing]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricing: {
                        ...formData.pricing,
                        [`pack${pack}`]: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Validity Periods */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Validity Period Pricing (Additional Cost)</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { key: 'oneYear', label: '1 Year' },
              { key: 'twoYear', label: '2 Years' },
              { key: 'threeYear', label: '3 Years' },
              { key: 'fourYear', label: '4 Years' },
              { key: 'fiveYear', label: '5 Years' },
            ].map((period) => (
              <div key={period.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {period.label} *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.validityPeriods[period.key as keyof typeof formData.validityPeriods]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      validityPeriods: {
                        ...formData.validityPeriods,
                        [period.key]: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/software')}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Updating...' : 'Update Software'}
          </button>
        </div>
      </form>
    </div>
  )
}
