"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import * as XLSX from "xlsx"
import { toast } from "react-hot-toast"
import { Download, Upload, FileSpreadsheet } from "lucide-react"

type Mode = "blocked" | "allowed" | "both"

interface PincodeEntry {
  pincode: string
  name: string
  state: string
  addedAt: string
}

export default function BlockedPincodesPage() {
  const [blockedPincodes, setBlockedPincodes] = useState<PincodeEntry[]>([])
  const [allowedPincodes, setAllowedPincodes] = useState<PincodeEntry[]>([])
  const [mode, setMode] = useState<Mode>("blocked")
  const [newPincode, setNewPincode] = useState("")
  const [newName, setNewName] = useState("")
  const [newState, setNewState] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  useEffect(() => {
    fetchPincodes()
  }, [])

  async function fetchPincodes() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch("/api/blocked-pincodes")
      const data = await res.json()
      setBlockedPincodes(data.blockedPincodes || [])
      setAllowedPincodes(data.allowedPincodes || [])
      setMode(data.mode || "blocked")
    } catch (e) {
      setError("Failed to load pincodes.")
    } finally {
      setLoading(false)
    }
  }

  async function updateMode(newMode: Mode) {
    setError(null)
    setSuccess(null)
    try {
      const res = await apiFetch("/api/blocked-pincodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      })
      if (res.ok) {
        setMode(newMode)
        const modeText = newMode === "blocked" ? "Blocked List" : newMode === "allowed" ? "Allowed List" : "Both Lists"
        setSuccess(`Mode changed to ${modeText}`)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError("Failed to update mode.")
      }
    } catch (e) {
      setError("Failed to update mode.")
    }
  }

  async function addPincode(listType: Mode) {
    if (!newPincode.trim()) {
      setError("Pincode is required")
      return
    }
    setError(null)
    setSuccess(null)
    try {
      const res = await apiFetch("/api/blocked-pincodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pincode: newPincode.trim(),
          name: newName.trim(),
          state: newState.trim(),
          listType
        }),
      })
      if (res.ok) {
        setNewPincode("")
        setNewName("")
        setNewState("")
        fetchPincodes()
        setSuccess(`Pincode ${newPincode} added to ${listType} list`)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError("Failed to add pincode.")
      }
    } catch (e) {
      setError("Failed to add pincode.")
    }
  }

  async function removePincode(pin: string, listType: Mode) {
    setError(null)
    setSuccess(null)
    try {
      const res = await apiFetch("/api/blocked-pincodes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: pin, listType }),
      })
      if (res.ok) {
        fetchPincodes()
        setSuccess(`Pincode ${pin} removed from ${listType} list`)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError("Failed to remove pincode.")
      }
    } catch (e) {
      setError("Failed to remove pincode.")
    }
  }

  // Download Sample Excel Template
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Pincode: "110001", Name: "Connaught Place", State: "Delhi" },
      { Pincode: "400001", Name: "Fort", State: "Maharashtra" },
      { Pincode: "560001", Name: "Bangalore GPO", State: "Karnataka" },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Allowed Pincodes")
    XLSX.writeFile(wb, "allowed_pincodes_template.xlsx")
    toast.success("Template downloaded successfully!")
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

      let successCount = 0
      let failCount = 0

      for (const row of jsonData) {
        const pincode = String(row.Pincode || row.pincode || "").trim()
        if (!pincode) continue

        const payload = {
          pincode,
          name: String(row.Name || row.name || "").trim(),
          state: String(row.State || row.state || "").trim(),
          listType: "allowed" as Mode
        }

        try {
          const res = await apiFetch("/api/blocked-pincodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })

          if (res.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch (err) {
          failCount++
        }
      }

      toast.success(`Upload complete: ${successCount} added, ${failCount} failed`, { id: toastId })
      fetchPincodes()
      setShowUploadModal(false)
      e.target.value = "" // Reset input
    } catch (error) {
      toast.error("Failed to process Excel file", { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Pincode Management</h1>

      {/* Mode Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Mode</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Choose which list to use for pincode validation during checkout
        </p>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="blocked"
              checked={mode === "blocked"}
              onChange={() => updateMode("blocked")}
              className="w-5 h-5 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="font-semibold text-lg">Blocked List</div>
              <div className="text-sm text-gray-600">Block specific pincodes from ordering</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="allowed"
              checked={mode === "allowed"}
              onChange={() => updateMode("allowed")}
              className="w-5 h-5 text-green-600 focus:ring-green-500"
            />
            <div>
              <div className="font-semibold text-lg">Allowed List</div>
              <div className="text-sm text-gray-600">Only allow specific pincodes to order</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="both"
              checked={mode === "both"}
              onChange={() => updateMode("both")}
              className="w-5 h-5 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <div className="font-semibold text-lg">Both Lists</div>
              <div className="text-sm text-gray-600">Use both allowed and blocked lists together</div>
            </div>
          </label>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Blocked Pincodes Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-red-600">Blocked Pincodes</h2>
              <span className="bg-red-100 text-red-800 text-sm font-medium px-3 py-1 rounded-full">
                {blockedPincodes.length} blocked
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Customers from these pincodes cannot place orders
            </p>

            <div className="mb-4 space-y-2">
              <input
                type="text"
                value={newPincode}
                onChange={e => setNewPincode(e.target.value)}
                placeholder="Pincode (e.g., 400001)"
                className="border border-gray-300 px-3 py-2 rounded w-full focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Area/Locality Name (optional)"
                className="border border-gray-300 px-3 py-2 rounded w-full focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <input
                type="text"
                value={newState}
                onChange={e => setNewState(e.target.value)}
                placeholder="State (optional)"
                className="border border-gray-300 px-3 py-2 rounded w-full focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <button
                onClick={() => addPincode("blocked")}
                className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition-colors w-full"
              >
                Add to Blocked List
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {blockedPincodes.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No blocked pincodes</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {blockedPincodes.map(entry => (
                    <li key={entry.pincode} className="py-3 hover:bg-gray-50 px-2 rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-mono text-lg font-semibold">{entry.pincode}</div>
                          {entry.name && <div className="text-sm text-gray-600 mt-1">{entry.name}</div>}
                          {entry.state && <div className="text-xs text-gray-500">{entry.state}</div>}
                        </div>
                        <button
                          onClick={() => removePincode(entry.pincode, "blocked")}
                          className="text-red-600 hover:text-red-800 hover:underline text-sm font-medium ml-4"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Allowed Pincodes Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-green-600">Allowed Pincodes</h2>
                <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                  {allowedPincodes.length} allowed
                </span>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Bulk Upload
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Only customers from these pincodes can place orders
            </p>

            <div className="mb-4 space-y-2">
              <input
                type="text"
                value={newPincode}
                onChange={e => setNewPincode(e.target.value)}
                placeholder="Pincode (e.g., 110001)"
                className="border border-gray-300 px-3 py-2 rounded w-full focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Area/Locality Name (optional)"
                className="border border-gray-300 px-3 py-2 rounded w-full focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="text"
                value={newState}
                onChange={e => setNewState(e.target.value)}
                placeholder="State (optional)"
                className="border border-gray-300 px-3 py-2 rounded w-full focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={() => addPincode("allowed")}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors w-full"
              >
                Add to Allowed List
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {allowedPincodes.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No allowed pincodes</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {allowedPincodes.map(entry => (
                    <li key={entry.pincode} className="py-3 hover:bg-gray-50 px-2 rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-mono text-lg font-semibold">{entry.pincode}</div>
                          {entry.name && <div className="text-sm text-gray-600 mt-1">{entry.name}</div>}
                          {entry.state && <div className="text-xs text-gray-500">{entry.state}</div>}
                        </div>
                        <button
                          onClick={() => removePincode(entry.pincode, "allowed")}
                          className="text-green-600 hover:text-green-800 hover:underline text-sm font-medium ml-4"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">Bulk Upload Allowed Pincodes</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Download Template */}
              <div className="p-4 border-2 border-blue-100 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Step 1: Download Template
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Download the sample Excel file to see the expected format with columns: Pincode, Name, State
                </p>
                <button
                  onClick={downloadTemplate}
                  className="w-full bg-white border-2 border-blue-200 text-blue-700 hover:bg-blue-50 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </button>
              </div>

              {/* Step 2: Upload File */}
              <div className="p-4 border-2 border-green-100 bg-green-50 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Step 2: Upload File
                </h3>
                <p className="text-sm text-green-700 mb-3">
                  Upload your filled Excel file here. All pincodes will be added to the Allowed List.
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleBulkUpload}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <button
                    disabled={isUploading}
                    className="w-full bg-green-600 text-white hover:bg-green-700 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Select File to Upload
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Info Note */}
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <strong>Note:</strong> The Excel file should have columns named "Pincode", "Name", and "State".
                Only the Pincode column is required.
              </div>
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
