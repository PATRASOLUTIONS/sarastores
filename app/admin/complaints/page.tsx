"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import {
  COMPLAINT_STATUS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_COLORS,
  COMPLAINT_TYPE_LABELS,
} from "@/lib/complaintTypes"

interface Complaint {
  id: string
  customerName: string
  email: string
  phone: string
  orderNumber: string
  complaintType: string
  subject: string
  description: string
  productName: string
  images?: string[]
  imageCount?: number
  status: string
  createdAt: string
  updatedAt: string
  timeline?: Array<{
    date: string
    status: string
    description: string
  }>
  lastAdminNote?: string
}

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState("")
  const [adminNote, setAdminNote] = useState("")

  useEffect(() => {
    fetchComplaints()
  }, [])

  const fetchComplaints = async () => {
    try {
      const response = await apiFetch("/api/complaints")
      const data = await response.json()
      setComplaints(data.complaints || [])
    } catch (error) {
      console.error("Error fetching complaints:", error)
    } finally {
      setLoading(false)
    }
  }

  // The list omits image blobs, so pull them only for the complaint being opened.
  const loadComplaintImages = async (complaint: Complaint) => {
    if (complaint.images || !complaint.imageCount) return
    try {
      const response = await apiFetch(`/api/complaints/${complaint.id}`)
      const data = await response.json()
      const images = data.complaint?.images || data.images
      if (images) {
        setSelectedComplaint((current) =>
          current && current.id === complaint.id ? { ...current, images } : current,
        )
      }
    } catch (error) {
      console.error("Error loading complaint images:", error)
    }
  }

  const handleStatusUpdate = async () => {
    if (!selectedComplaint || !newStatus) return

    setUpdating(true)
    try {
      const response = await apiFetch(`/api/complaints/${selectedComplaint.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, adminNote }),
      })

      if (response.ok) {
        alert("Status updated successfully! Customer will receive an email notification.")
        fetchComplaints()
        setSelectedComplaint(null)
        setNewStatus("")
        setAdminNote("")
      } else {
        alert("Failed to update status")
      }
    } catch (error) {
      console.error("Error updating status:", error)
      alert("An error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (complaintId: string) => {
    if (!confirm("Are you sure you want to permanently delete this complaint? This action cannot be undone.")) return

    setDeleting(complaintId)
    try {
      const response = await apiFetch(`/api/complaints/${complaintId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setComplaints((prev) => prev.filter((c) => c.id !== complaintId))
        if (selectedComplaint?.id === complaintId) setSelectedComplaint(null)
      } else {
        alert("Failed to delete complaint")
      }
    } catch (error) {
      console.error("Error deleting complaint:", error)
      alert("An error occurred while deleting")
    } finally {
      setDeleting(null)
    }
  }

  const filteredComplaints =
    statusFilter === "all" ? complaints : complaints.filter((c) => c.status === statusFilter)

  const getStatusCount = (status: string) => {
    return complaints.filter((c) => c.status === status).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading complaints...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Complaint Management</h1>
        <p className="text-gray-600 mt-2">Manage and respond to customer complaints</p>
      </div>

      {/* Status Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter("all")}
          className={`p-4 rounded-lg border-2 transition-all ${
            statusFilter === "all"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="text-2xl font-bold text-gray-900">{complaints.length}</div>
          <div className="text-sm text-gray-600">All Complaints</div>
        </button>

        {Object.entries(COMPLAINT_STATUS).map(([key, value]) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`p-4 rounded-lg border-2 transition-all ${
              statusFilter === value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{getStatusCount(value)}</div>
            <div className="text-sm text-gray-600">{COMPLAINT_STATUS_LABELS[value]}</div>
          </button>
        ))}
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No complaints found
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((complaint) => (
                  <tr key={complaint.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{complaint.id.slice(-6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{complaint.customerName}</div>
                      <div className="text-sm text-gray-500">{complaint.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {complaint.orderNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{COMPLAINT_TYPE_LABELS[complaint.complaintType]}</span>
                        {(complaint.imageCount ?? complaint.images?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            📸 {complaint.imageCount ?? complaint.images?.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {complaint.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          COMPLAINT_STATUS_COLORS[complaint.status]
                        }`}
                      >
                        {COMPLAINT_STATUS_LABELS[complaint.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(complaint.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setSelectedComplaint(complaint)
                            setNewStatus(complaint.status)
                            setAdminNote("")
                            loadComplaintImages(complaint)
                          }}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleDelete(complaint.id)}
                          disabled={deleting === complaint.id}
                          className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                        >
                          {deleting === complaint.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complaint Details Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Complaint Details</h2>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-3">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Name:</span>
                    <p className="font-medium">{selectedComplaint.customerName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Email:</span>
                    <p className="font-medium">{selectedComplaint.email}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Phone:</span>
                    <p className="font-medium">{selectedComplaint.phone}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Order Number:</span>
                    <p className="font-medium">{selectedComplaint.orderNumber}</p>
                  </div>
                </div>
              </div>

              {/* Complaint Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-3">Complaint Information</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Type:</span>
                    <p className="font-medium">{COMPLAINT_TYPE_LABELS[selectedComplaint.complaintType]}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Product:</span>
                    <p className="font-medium">{selectedComplaint.productName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Subject:</span>
                    <p className="font-medium">{selectedComplaint.subject}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Description:</span>
                    <p className="mt-1 text-gray-800">{selectedComplaint.description}</p>
                  </div>
                </div>
              </div>

              {/* Images Gallery */}
              {selectedComplaint.images && selectedComplaint.images.length > 0 && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">📸 Uploaded Images ({selectedComplaint.images.length})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedComplaint.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image}
                          alt={`Complaint image ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg border-2 border-purple-200 cursor-pointer hover:border-purple-400 transition-all"
                          onClick={() => window.open(image, '_blank')}
                        />
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                          Click to enlarge
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    💡 Click on any image to view in full size
                  </p>
                </div>
              )}

              {/* Timeline */}
              {selectedComplaint.timeline && selectedComplaint.timeline.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">Timeline</h3>
                  <div className="space-y-3">
                    {selectedComplaint.timeline.map((event, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium">{event.status}</span>
                            <span className="text-sm text-gray-500">
                              {new Date(event.date).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Update Status */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-3">Update Status</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(COMPLAINT_STATUS).map(([key, value]) => (
                        <option key={value} value={value}>
                          {COMPLAINT_STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Note (Optional)
                    </label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Add a note for the customer..."
                    />
                  </div>

                  <button
                    onClick={handleStatusUpdate}
                    disabled={updating || newStatus === selectedComplaint.status}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? "Updating..." : "Update Status & Send Email"}
                  </button>

                  <button
                    onClick={() => {
                      handleDelete(selectedComplaint.id)
                    }}
                    disabled={deleting === selectedComplaint.id}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {deleting === selectedComplaint.id ? "Deleting..." : "Delete Complaint"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
