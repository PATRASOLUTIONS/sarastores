"use client"

import { useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { COMPLAINT_TYPES, COMPLAINT_TYPE_LABELS } from "@/lib/complaintTypes"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import BrandMarquee from "@/components/BrandMarquee"
import HeroSection from "@/components/HeroSection"

export default function ComplaintForm() {
  const [formData, setFormData] = useState({
    customerName: "",
    email: "",
    phone: "",
    orderNumber: "",
    complaintType: "",
    subject: "",
    description: "",
    productName: "",
  })
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const lock = useSubmitLock()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Complaint types that require images
  const imageRequiredTypes = ["breakage", "return", "defective"]
  const requiresImages = imageRequiredTypes.includes(formData.complaintType)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // Limit to 5 images
    if (files.length + images.length > 5) {
      setMessage({ type: "error", text: "Maximum 5 images allowed" })
      return
    }

    const newImages: string[] = []
    let processedCount = 0

    Array.from(files).forEach((file) => {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "Each image must be less than 5MB" })
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        newImages.push(reader.result as string)
        processedCount++

        if (processedCount === files.length) {
          setImages([...images, ...newImages])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock.acquire()) return
    setLoading(true)
    setMessage(null)

    // Validate images for specific complaint types
    if (requiresImages && images.length === 0) {
      setMessage({ type: "error", text: "Please upload at least one image for this complaint type" })
      setLoading(false)
      lock.release()
      return
    }

    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, images }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          type: "success",
          text: `Complaint submitted successfully! Reference ID: ${data.complaint.id}`,
        })
        setFormData({
          customerName: "",
          email: "",
          phone: "",
          orderNumber: "",
          complaintType: "",
          subject: "",
          description: "",
          productName: "",
        })
        setImages([])
      } else {
        setMessage({ type: "error", text: data.error || "Failed to submit complaint" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred. Please try again." })
    } finally {
      lock.release()
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <BrandMarquee />
      <HeroSection />
      <div className="flex-grow bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* Header */}
          <div 
            className="px-6 py-8 text-white"
            style={{ background: 'linear-gradient(135deg, #2A7FFF 0%, #1E40AF 100%)' }}
          >
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>Submit a Complaint</h1>
            <p className="mt-2" style={{ color: '#E0F2FE' }}>
              We're here to help! Please provide details about your issue and we'll get back to you soon.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-8 space-y-6">
            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Personal Information */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+91 12345 67890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ORD123456"
                  />
                </div>
              </div>
            </div>

            {/* Complaint Details */}
            <div className="space-y-4 pt-4 border-t">
              <h2 className="text-xl font-semibold text-gray-900">Complaint Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complaint Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.complaintType}
                  onChange={(e) => setFormData({ ...formData, complaintType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a complaint type</option>
                  {Object.entries(COMPLAINT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Product name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief summary of your issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Please provide detailed information about your complaint..."
                />
              </div>

              {/* Image Upload - Only for specific complaint types */}
              {requiresImages && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Images <span className="text-red-500">*</span>
                  </label>
                  <p className="text-sm text-gray-600 mb-3">
                    Please upload clear photos of the issue (max 5 images, 5MB each)
                  </p>
                  
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  {/* Image Preview */}
                  {images.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                      {images.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    {images.length}/5 images uploaded
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 px-6 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                style={{ 
                  backgroundColor: loading ? '#94A3B8' : '#2A7FFF',
                  fontFamily: 'Roboto, sans-serif'
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1E5FCC')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#2A7FFF')}
              >
                {loading ? "Submitting..." : "Submit Complaint"}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📧 What happens next?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• You'll receive a confirmation email with your complaint reference ID</li>
            <li>• Our team will review your complaint within 24-48 hours</li>
            <li>• You'll receive email updates as your complaint status changes</li>
            <li>• You can contact us at info@saramobiles.com for urgent matters</li>
          </ul>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  )
}
