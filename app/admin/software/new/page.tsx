'use client'


import { apiFetch } from "@/lib/api-client"
import { useState } from 'react'
import { useSubmitLock } from '@/hooks/useSubmitLock'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewSoftwarePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const lock = useSubmitLock()
  const [formData, setFormData] = useState({
    name: '',
    shortDescription: '',
    description: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock.acquire()) return
    setLoading(true)

    try {
      // Clean up empty features and OS
      const cleanedData = {
        ...formData,
        features: formData.features.filter(f => f.trim() !== ''),
        systemRequirements: {
          ...formData.systemRequirements,
          os: formData.systemRequirements.os.filter(o => o.trim() !== ''),
        },
      }

      const response = await apiFetch('/api/software', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Software product created successfully!')
        router.push('/admin/software')
      } else {
        toast.error(data.error || 'Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error('Failed to create product')
    } finally {
      lock.release()
      setLoading(false)
    }
  }

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, ''],
    })
  }

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features]
    newFeatures[index] = value
    setFormData({ ...formData, features: newFeatures })
  }

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    })
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

  const removeOS = (index: number) => {
    setFormData({
      ...formData,
      systemRequirements: {
        ...formData.systemRequirements,
        os: formData.systemRequirements.os.filter((_, i) => i !== index),
      },
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/software"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Software Products
        </Link>
        <h1 className="text-3xl font-bold">Add New Software Product</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Microsoft Office 365"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Short Description *</label>
              <input
                type="text"
                required
                value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Brief one-line description"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Full Description *</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Detailed product description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category *</label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Productivity, Security"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Image URL *</label>
              <input
                type="url"
                required
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Features</h2>
          
          {formData.features.map((feature, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={feature}
                onChange={(e) => updateFeature(index, e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Feature description"
              />
              <button
                type="button"
                onClick={() => removeFeature(index)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                Remove
              </button>
            </div>
          ))}
          
          <button
            type="button"
            onClick={addFeature}
            className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Feature
          </button>
        </div>

        {/* System Requirements */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">System Requirements</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Operating Systems</label>
              {formData.systemRequirements.os.map((os, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={os}
                    onChange={(e) => updateOS(index, e.target.value)}
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Windows 10/11"
                  />
                  <button
                    type="button"
                    onClick={() => removeOS(index)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addOS}
                className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add OS
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Processor</label>
                <input
                  type="text"
                  value={formData.systemRequirements.processor}
                  onChange={(e) => setFormData({
                    ...formData,
                    systemRequirements: { ...formData.systemRequirements, processor: e.target.value }
                  })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Intel i5 or equivalent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">RAM</label>
                <input
                  type="text"
                  value={formData.systemRequirements.ram}
                  onChange={(e) => setFormData({
                    ...formData,
                    systemRequirements: { ...formData.systemRequirements, ram: e.target.value }
                  })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 8GB"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Storage</label>
                <input
                  type="text"
                  value={formData.systemRequirements.storage}
                  onChange={(e) => setFormData({
                    ...formData,
                    systemRequirements: { ...formData.systemRequirements, storage: e.target.value }
                  })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 10GB"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pricing - Pack Sizes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Pack Pricing (Base Price)</h2>
          <p className="text-sm text-gray-600 mb-4">Set base prices for different license pack sizes</p>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((pack) => (
              <div key={pack}>
                <label className="block text-sm font-medium mb-2">{pack} License(s)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.pricing[`pack${pack}` as keyof typeof formData.pricing]}
                  onChange={(e) => setFormData({
                    ...formData,
                    pricing: { ...formData.pricing, [`pack${pack}`]: Number(e.target.value) }
                  })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="₹"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Validity Periods */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Validity Period Pricing (Additional Cost)</h2>
          <p className="text-sm text-gray-600 mb-4">Set additional prices for different validity periods</p>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { key: 'oneYear', label: '1 Year' },
              { key: 'twoYear', label: '2 Years' },
              { key: 'threeYear', label: '3 Years' },
              { key: 'fourYear', label: '4 Years' },
              { key: 'fiveYear', label: '5 Years' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-2">{label}</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.validityPeriods[key as keyof typeof formData.validityPeriods]}
                  onChange={(e) => setFormData({
                    ...formData,
                    validityPeriods: { ...formData.validityPeriods, [key]: Number(e.target.value) }
                  })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="₹"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Creating...' : 'Create Software Product'}
          </button>
          <Link
            href="/admin/software"
            className="px-8 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
