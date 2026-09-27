"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, useRef } from "react"
import * as XLSX from "xlsx"
import { toast } from "react-hot-toast"
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Edit, 
  MapPin, 
  Phone, 
  Clock, 
  Mail, 
  Store, 
  X, 
  Save,
  Image as ImageIcon,
  ExternalLink,
  Search,
  RefreshCw
} from "lucide-react"

interface StoreLocation {
  id: string
  shopName: string
  locationDescription: string
  googleMapLocation: string
  mobileNo: string
  shopTiming: string
  shopImage: string
  emailId: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

const EMPTY_STORE: Omit<StoreLocation, 'id' | 'createdAt' | 'updatedAt'> = {
  shopName: "",
  locationDescription: "",
  googleMapLocation: "",
  mobileNo: "",
  shopTiming: "9:00 AM - 9:00 PM",
  shopImage: "",
  emailId: "",
  isActive: true,
}

export default function StoreLocationsPage() {
  const [stores, setStores] = useState<StoreLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStore, setEditingStore] = useState<StoreLocation | null>(null)
  const [newStore, setNewStore] = useState<Omit<StoreLocation, 'id' | 'createdAt' | 'updatedAt'>>(EMPTY_STORE)
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchStores()
  }, [])

  async function fetchStores() {
    setLoading(true)
    try {
      const res = await apiFetch("/api/admin/store-locations")
      const data = await res.json()
      if (data.success) {
        setStores(data.stores || [])
      } else {
        toast.error("Failed to load stores")
      }
    } catch (e) {
      toast.error("Failed to load stores")
    } finally {
      setLoading(false)
    }
  }

  // Download Sample Excel Template
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 
        "Shop Name": "Sara Mobiles - Main Branch",
        "Location Description": "No.4/7, Shop No. 2, Ground Floor, Main Road, City Center, Bangalore - 560001",
        "Google Map Location": "https://maps.google.com/?q=12.9716,77.5946",
        "Mobile No": "9876543210",
        "Shop Timing": "9:00 AM - 9:00 PM",
        "Shop Image": "https://example.com/shop-image.jpg",
        "Email ID": "mainbranch@saramobiles.com",
        "Is Active": "Yes"
      },
      { 
        "Shop Name": "Sara Mobiles - City Mall",
        "Location Description": "Shop No. 15, First Floor, City Mall, MG Road, Bangalore - 560002",
        "Google Map Location": "https://maps.google.com/?q=12.9756,77.6066",
        "Mobile No": "9876543211",
        "Shop Timing": "10:00 AM - 10:00 PM",
        "Shop Image": "https://example.com/shop2-image.jpg",
        "Email ID": "citymall@saramobiles.com",
        "Is Active": "Yes"
      },
    ])
    
    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Shop Name
      { wch: 60 }, // Location Description
      { wch: 50 }, // Google Map Location
      { wch: 15 }, // Mobile No
      { wch: 20 }, // Shop Timing
      { wch: 40 }, // Shop Image
      { wch: 30 }, // Email ID
      { wch: 10 }, // Is Active
    ]
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Store Locations")
    XLSX.writeFile(wb, "store_locations_template.xlsx")
    toast.success("Template downloaded successfully!")
  }

  // Export current stores to Excel
  const exportStores = () => {
    if (stores.length === 0) {
      toast.error("No stores to export")
      return
    }

    const exportData = stores.map(store => ({
      "Shop Name": store.shopName,
      "Location Description": store.locationDescription,
      "Google Map Location": store.googleMapLocation,
      "Mobile No": store.mobileNo,
      "Shop Timing": store.shopTiming,
      "Shop Image": store.shopImage,
      "Email ID": store.emailId,
      "Is Active": store.isActive ? "Yes" : "No",
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    ws['!cols'] = [
      { wch: 30 }, { wch: 60 }, { wch: 50 }, { wch: 15 }, 
      { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 10 },
    ]
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Store Locations")
    XLSX.writeFile(wb, `store_locations_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success("Stores exported successfully!")
  }

  // Handle Bulk Upload
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const toastId = toast.loading("Processing file...")

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        toast.error("No data found in the file", { id: toastId })
        return
      }

      const storesPayload = jsonData.map((row, index) => ({
        shopName: String(row["Shop Name"] || row.shopName || "").trim(),
        locationDescription: String(row["Location Description"] || row.locationDescription || "").trim(),
        googleMapLocation: String(row["Google Map Location"] || row.googleMapLocation || "").trim(),
        mobileNo: String(row["Mobile No"] || row.mobileNo || "").trim(),
        shopTiming: String(row["Shop Timing"] || row.shopTiming || "9:00 AM - 9:00 PM").trim(),
        shopImage: String(row["Shop Image"] || row.shopImage || "").trim(),
        emailId: String(row["Email ID"] || row.emailId || "").trim(),
        isActive: String(row["Is Active"] || row.isActive || "Yes").toLowerCase() === "yes",
      })).filter(store => store.shopName)

      const res = await apiFetch("/api/admin/store-locations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stores: storesPayload })
      })

      const result = await res.json()

      if (result.success) {
        toast.success(`Upload complete: ${result.inserted} added, ${result.updated} updated`, { id: toastId })
        fetchStores()
        setShowUploadModal(false)
      } else {
        toast.error(result.message || "Upload failed", { id: toastId })
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      toast.error("Failed to process Excel file", { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  // Add new store
  const handleAddStore = async () => {
    if (!newStore.shopName.trim()) {
      toast.error("Shop name is required")
      return
    }

    const toastId = toast.loading("Adding store...")
    try {
      const res = await apiFetch("/api/admin/store-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStore)
      })

      const result = await res.json()

      if (result.success) {
        toast.success("Store added successfully!", { id: toastId })
        setNewStore(EMPTY_STORE)
        setShowAddModal(false)
        fetchStores()
      } else {
        toast.error(result.message || "Failed to add store", { id: toastId })
      }
    } catch (error) {
      toast.error("Failed to add store", { id: toastId })
    }
  }

  // Update store
  const handleUpdateStore = async () => {
    if (!editingStore) return

    const toastId = toast.loading("Updating store...")
    try {
      const res = await apiFetch(`/api/admin/store-locations/${editingStore.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingStore)
      })

      const result = await res.json()

      if (result.success) {
        toast.success("Store updated successfully!", { id: toastId })
        setEditingStore(null)
        setShowEditModal(false)
        fetchStores()
      } else {
        toast.error(result.message || "Failed to update store", { id: toastId })
      }
    } catch (error) {
      toast.error("Failed to update store", { id: toastId })
    }
  }

  // Delete store
  const handleDeleteStore = async (id: string) => {
    if (!confirm("Are you sure you want to delete this store?")) return

    const toastId = toast.loading("Deleting store...")
    try {
      const res = await apiFetch(`/api/admin/store-locations/${id}`, {
        method: "DELETE"
      })

      const result = await res.json()

      if (result.success) {
        toast.success("Store deleted successfully!", { id: toastId })
        fetchStores()
      } else {
        toast.error(result.message || "Failed to delete store", { id: toastId })
      }
    } catch (error) {
      toast.error("Failed to delete store", { id: toastId })
    }
  }

  // Toggle store active status
  const handleToggleActive = async (store: StoreLocation) => {
    const toastId = toast.loading("Updating status...")
    try {
      const res = await apiFetch(`/api/admin/store-locations/${store.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...store, isActive: !store.isActive })
      })

      const result = await res.json()

      if (result.success) {
        toast.success(`Store ${store.isActive ? 'deactivated' : 'activated'} successfully!`, { id: toastId })
        fetchStores()
      } else {
        toast.error("Failed to update status", { id: toastId })
      }
    } catch (error) {
      toast.error("Failed to update status", { id: toastId })
    }
  }

  // Filter stores based on search
  const filteredStores = stores.filter(store => 
    store.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.locationDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.mobileNo.includes(searchQuery) ||
    store.emailId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Store Form Component
  const StoreForm = ({ 
    store, 
    onChange, 
    onSave, 
    onCancel, 
    title 
  }: { 
    store: Omit<StoreLocation, 'id' | 'createdAt' | 'updatedAt'> | StoreLocation
    onChange: (field: string, value: any) => void
    onSave: () => void
    onCancel: () => void
    title: string
  }) => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          {/* Shop Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Store className="w-4 h-4 inline mr-2" />
              Shop Name *
            </label>
            <input
              type="text"
              value={store.shopName}
              onChange={(e) => onChange('shopName', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Enter shop name"
            />
          </div>

          {/* Location Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              Location Description *
            </label>
            <textarea
              value={store.locationDescription}
              onChange={(e) => onChange('locationDescription', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              placeholder="Enter complete address"
            />
          </div>

          {/* Google Map Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ExternalLink className="w-4 h-4 inline mr-2" />
              Google Map Location URL
            </label>
            <input
              type="url"
              value={store.googleMapLocation}
              onChange={(e) => onChange('googleMapLocation', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="https://maps.google.com/..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Mobile Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Mobile Number *
              </label>
              <input
                type="tel"
                value={store.mobileNo}
                onChange={(e) => onChange('mobileNo', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="9876543210"
              />
            </div>

            {/* Shop Timing */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Shop Timing
              </label>
              <input
                type="text"
                value={store.shopTiming}
                onChange={(e) => onChange('shopTiming', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="9:00 AM - 9:00 PM"
              />
            </div>
          </div>

          {/* Email ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Email ID
            </label>
            <input
              type="email"
              value={store.emailId}
              onChange={(e) => onChange('emailId', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="store@example.com"
            />
          </div>

          {/* Shop Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ImageIcon className="w-4 h-4 inline mr-2" />
              Shop Image URL
            </label>
            <input
              type="url"
              value={store.shopImage}
              onChange={(e) => onChange('shopImage', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="https://example.com/shop-image.jpg"
            />
            {store.shopImage && (
              <div className="mt-3 relative">
                <img 
                  src={store.shopImage} 
                  alt="Shop preview" 
                  className="w-full h-40 object-cover rounded-xl border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-store.jpg'
                  }}
                />
              </div>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={store.isActive}
              onChange={(e) => onChange('isActive', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Store is Active
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Store
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Store Locations Management</h1>
        <p className="text-gray-600">Manage all store locations, upload from Excel, and export data</p>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchStores()}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Template
            </button>
            <button
              onClick={exportStores}
              className="px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Excel
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Store
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Stores</p>
              <p className="text-3xl font-bold mt-1">{stores.length}</p>
            </div>
            <Store className="w-12 h-12 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Active Stores</p>
              <p className="text-3xl font-bold mt-1">{stores.filter(s => s.isActive).length}</p>
            </div>
            <MapPin className="w-12 h-12 text-green-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Inactive Stores</p>
              <p className="text-3xl font-bold mt-1">{stores.filter(s => !s.isActive).length}</p>
            </div>
            <Store className="w-12 h-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Store Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
          <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No stores found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery ? "Try adjusting your search query" : "Get started by adding your first store location"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Your First Store
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <div
              key={store.id}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg transition-all duration-300 ${
                !store.isActive ? 'opacity-60' : ''
              }`}
            >
              {/* Store Image */}
              <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
                {store.shopImage ? (
                  <img
                    src={store.shopImage}
                    alt={store.shopName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Store className="w-20 h-20 text-blue-300" />
                  </div>
                )}
                {/* Status Badge */}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium ${
                  store.isActive 
                    ? 'bg-green-500 text-white' 
                    : 'bg-red-500 text-white'
                }`}>
                  {store.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>

              {/* Store Details */}
              <div className="p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-1">
                  {store.shopName}
                </h3>

                <div className="space-y-3">
                  {/* Location */}
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600 line-clamp-2">{store.locationDescription}</p>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <a href={`tel:${store.mobileNo}`} className="text-sm text-gray-900 font-medium hover:text-blue-600">
                      {store.mobileNo}
                    </a>
                  </div>

                  {/* Timing */}
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <p className="text-sm text-gray-600">{store.shopTiming}</p>
                  </div>

                  {/* Email */}
                  {store.emailId && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      <a href={`mailto:${store.emailId}`} className="text-sm text-gray-600 hover:text-blue-600 truncate">
                        {store.emailId}
                      </a>
                    </div>
                  )}
                </div>

                {/* Google Maps Link */}
                {store.googleMapLocation && (
                  <a
                    href={store.googleMapLocation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Google Maps
                  </a>
                )}

                {/* Action Buttons */}
                <div className="mt-4 pt-4 border-t flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingStore(store)
                      setShowEditModal(true)
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(store)}
                    className={`flex-1 px-4 py-2.5 rounded-xl transition-colors font-medium flex items-center justify-center gap-2 text-sm ${
                      store.isActive 
                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {store.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteStore(store.id)}
                    className="px-3 py-2.5 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Import Store Locations</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Upload an Excel file with store locations</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="excel-upload"
                />
                <label
                  htmlFor="excel-upload"
                  className={`inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium cursor-pointer hover:bg-blue-700 transition-colors ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload className="w-5 h-5" />
                  {isUploading ? 'Uploading...' : 'Select File'}
                </label>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-medium text-blue-900 mb-2">Excel Format Required:</h3>
              <p className="text-sm text-blue-700 mb-3">Your Excel file should have these columns:</p>
              <ul className="text-sm text-blue-600 space-y-1">
                <li>• Shop Name (required)</li>
                <li>• Location Description</li>
                <li>• Google Map Location</li>
                <li>• Mobile No</li>
                <li>• Shop Timing</li>
                <li>• Shop Image</li>
                <li>• Email ID</li>
                <li>• Is Active (Yes/No)</li>
              </ul>
              <button
                onClick={downloadTemplate}
                className="mt-4 text-blue-700 font-medium text-sm hover:underline flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Download Sample Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Store Modal */}
      {showAddModal && (
        <StoreForm
          store={newStore}
          onChange={(field, value) => setNewStore(prev => ({ ...prev, [field]: value }))}
          onSave={handleAddStore}
          onCancel={() => {
            setShowAddModal(false)
            setNewStore(EMPTY_STORE)
          }}
          title="Add New Store"
        />
      )}

      {/* Edit Store Modal */}
      {showEditModal && editingStore && (
        <StoreForm
          store={editingStore}
          onChange={(field, value) => setEditingStore(prev => prev ? { ...prev, [field]: value } : null)}
          onSave={handleUpdateStore}
          onCancel={() => {
            setShowEditModal(false)
            setEditingStore(null)
          }}
          title="Edit Store"
        />
      )}
    </div>
  )
}
