"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, use } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { ArrowLeft, Building2, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

interface PartnerForm {
  name: string;

  email: string;
  phone: string;
  website: string;
  tier: 'starter' | 'growth' | 'professional' | 'enterprise';
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  commissionRate: number;
  gstin: string;
  pan: string;
  businessType: string;
  addressLine1: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactDesignation: string;
}

export default function EditPartnerPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const lock = useSubmitLock()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<PartnerForm>({
    name: '',
    email: '',
    phone: '',
    website: '',
    tier: 'starter',
    status: 'pending',
    commissionRate: 15,
    gstin: '',
    pan: '',
    businessType: 'pvt_ltd',
    addressLine1: '',
    addressCity: '',
    addressState: '',
    addressPincode: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
  })

  useEffect(() => {
    fetchPartner()
  }, [partnerId])

  const fetchPartner = async () => {
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}`)
      const data = await response.json()
      
      if (data.success && data.data.partner) {
        const p = data.data.partner
        setForm({
          name: p.name || '',
          email: p.email || '',
          phone: p.phone || '',
          website: p.website || '',
          tier: p.tier || 'starter',
          status: p.status || 'pending',
          commissionRate: p.commissionRate || 15,
          gstin: p.businessDetails?.gstin || '',
          pan: p.businessDetails?.pan || '',
          businessType: p.businessDetails?.businessType || 'pvt_ltd',
          addressLine1: p.businessDetails?.registeredAddress?.line1 || '',
          addressCity: p.businessDetails?.registeredAddress?.city || '',
          addressState: p.businessDetails?.registeredAddress?.state || '',
          addressPincode: p.businessDetails?.registeredAddress?.pincode || '',
          contactName: p.contactPerson?.name || '',
          contactEmail: p.contactPerson?.email || '',
          contactPhone: p.contactPerson?.phone || '',
          contactDesignation: p.contactPerson?.designation || '',
        })
      } else {
        toast.error('Partner not found')
        router.push('/admin/partners')
      }
    } catch (error) {
      console.error('Error fetching partner:', error)
      toast.error('Failed to fetch partner')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.name || !form.email || !form.phone) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!lock.acquire()) return
    setIsSubmitting(true)
    
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          website: form.website || undefined,
          tier: form.tier,
          status: form.status,
          commissionRate: form.commissionRate,
          businessDetails: {
            gstin: form.gstin,
            pan: form.pan,
            businessType: form.businessType,
            registeredAddress: {
              line1: form.addressLine1,
              city: form.addressCity,
              state: form.addressState,
              pincode: form.addressPincode,
              country: 'India',
            },
          },
          contactPerson: form.contactName ? {
            name: form.contactName,
            email: form.contactEmail,
            phone: form.contactPhone,
            designation: form.contactDesignation,
          } : undefined,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('Partner updated successfully')
        router.push(`/admin/partners/${partnerId}`)
      } else {
        toast.error(data.error?.message || 'Failed to update partner')
      }
    } catch (error) {
      console.error('Error updating partner:', error)
      toast.error('Failed to update partner')
    } finally {
      lock.release()
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/partners/${partnerId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Partner</h1>
          <p className="text-gray-600 mt-1">Update partner information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={form.website}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Status, Tier & Commission */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status, Tier & Commission</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Partner Tier
              </label>
              <select
                name="tier"
                value={form.tier}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commission Rate (%)
              </label>
              <input
                type="number"
                name="commissionRate"
                value={form.commissionRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.5"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Business Details */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GSTIN
              </label>
              <input
                type="text"
                name="gstin"
                value={form.gstin}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                maxLength={15}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PAN
              </label>
              <input
                type="text"
                name="pan"
                value={form.pan}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                maxLength={10}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Type
              </label>
              <select
                name="businessType"
                value={form.businessType}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="sole_proprietorship">Sole Proprietorship</option>
                <option value="partnership">Partnership</option>
                <option value="llp">LLP</option>
                <option value="pvt_ltd">Private Limited</option>
                <option value="public_ltd">Public Limited</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Registered Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                name="addressLine1"
                value={form.addressLine1}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                name="addressCity"
                value={form.addressCity}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                name="addressState"
                value={form.addressState}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pincode
              </label>
              <input
                type="text"
                name="addressPincode"
                value={form.addressPincode}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={6}
              />
            </div>
          </div>
        </div>

        {/* Contact Person */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Person</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="contactEmail"
                value={form.contactEmail}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="contactPhone"
                value={form.contactPhone}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Designation
              </label>
              <input
                type="text"
                name="contactDesignation"
                value={form.contactDesignation}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link
            href={`/admin/partners/${partnerId}`}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
