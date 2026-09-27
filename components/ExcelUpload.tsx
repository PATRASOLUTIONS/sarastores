"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Canonical required columns for product import. Other columns are optional and can be ignored.
const REQUIRED_COLUMNS = [
  "itemno",
  "Name",
  "Description",
  "Category/Group Name",
  "sub-category/PROD DESC",
  "CHAR DESC",
  "Manufacturer Name",
]

interface ValidationError {
  row: number
  field: string
  message: string
}

interface DuplicateSKU {
  sku: string
  existingProduct: string
  newProduct: string
}

interface UploadResult {
  success: boolean
  message: string
  inserted?: number
  updated?: number
  errors?: ValidationError[]
  duplicates?: DuplicateSKU[]
}

export default function ExcelUpload({
  onUploadComplete,
  uploadUrl = "/api/products/upload-excel",
  title = "Upload Products from Excel",
  description = "Upload an Excel file (.xlsx). Required columns: itemno, Name, Description, Category/Group Name, sub-category/PROD DESC, CHAR DESC, Manufacturer Name. Other columns are optional and will be ignored.",
  requiredColumns = REQUIRED_COLUMNS,
  triggerLabel = "Products Upload Excel",
}: {
  onUploadComplete?: () => void
  uploadUrl?: string
  title?: string
  description?: string
  requiredColumns?: string[]
  triggerLabel?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ]
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith(".xlsx")) {
        alert("Please upload a valid Excel file (.xlsx or .xls)")
        return
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB")
        return
      }

      setFile(selectedFile)
      setResult(null)
      setShowDuplicateWarning(false)
    }
  }

  const addMissingFields = (rows: Record<string, any>[]) => {
    return rows.map(row => {
      const newRow = { ...row }
      REQUIRED_COLUMNS.forEach(col => {
        if (!(col in newRow)) {
          newRow[col] = ""
        }
      })
      return newRow
    })
  }

  const handleUpload = async (overwriteDuplicates = false) => {
    if (!file) return

    setIsUploading(true)
    setResult(null)

    try {
      if (process.env.NODE_ENV === "development") console.log('Starting upload of file:', file.name)
      if (process.env.NODE_ENV === "development") console.log('File size:', (file.size / 1024).toFixed(2), 'KB')

      const formData = new FormData()
      formData.append("file", file)
      formData.append("overwriteDuplicates", overwriteDuplicates.toString())

      if (process.env.NODE_ENV === "development") console.log('Uploading with overwriteDuplicates:', overwriteDuplicates)

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      })

      const data: UploadResult = await response.json()
      if (process.env.NODE_ENV === "development") console.log('Upload response:', {
        success: data.success,
        inserted: data.inserted,
        updated: data.updated,
        duplicatesCount: data.duplicates?.length,
        errorsCount: data.errors?.length
      })

      if (data.duplicates && data.duplicates.length > 0 && !overwriteDuplicates) {
        setShowDuplicateWarning(true)
        setResult(data)
      } else {
        setResult(data)
        if (data.success) {
          setTimeout(() => {
            setIsOpen(false)
            setFile(null)
            setResult(null)
            setShowDuplicateWarning(false)
            if (onUploadComplete) onUploadComplete()
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to upload file",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleConfirmOverwrite = () => {
    setShowDuplicateWarning(false)
    handleUpload(true)
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setShowDuplicateWarning(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white">
          <Upload className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader className="bg-white p-4 rounded-t-md">
          <div className="relative">
            <DialogTitle className="bg-white">{title}</DialogTitle>
            <button
              aria-label="Close"
              className="absolute right-0 top-0 text-gray-500 hover:text-gray-700"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-upload"
            />
            <label htmlFor="excel-upload" className="cursor-pointer block">
              <div className="flex items-center justify-center">
                <FileSpreadsheet className="h-10 w-10 text-gray-400 mr-3" />
                <div className="text-left">
                  <p className="text-sm text-gray-700 font-medium">{file ? file.name : "Click to select an Excel file"}</p>
                  <p className="text-xs text-gray-500">{file ? `${(file.size / 1024).toFixed(0)} KB` : ".xlsx or .xls — Max 10MB"}</p>
                </div>
              </div>
            </label>
          </div>

          {/* Required Columns List (badges) */}
          <div className="bg-gray-50 border border-gray-100 rounded p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Expected Columns</p>
            <div className="flex flex-wrap gap-2">
              {requiredColumns.map((col) => (
                <span key={col} className="inline-flex items-center text-xs bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-700">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Duplicate Warning */}
          {showDuplicateWarning && result?.duplicates && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-yellow-800 mb-2">Duplicate SKUs Found</h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    The following SKUs already exist in the database. Do you want to overwrite them?
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
                    {result.duplicates.map((dup, idx) => (
                      <div key={idx} className="text-xs bg-white p-2 rounded border border-yellow-200">
                        <p className="font-medium">SKU: {dup.sku}</p>
                        <p className="text-gray-600">Existing: {dup.existingProduct}</p>
                        <p className="text-gray-600">New: {dup.newProduct}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleConfirmOverwrite}
                      disabled={isUploading}
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      Overwrite Existing
                    </Button>
                    <Button onClick={handleReset} variant="outline" disabled={isUploading}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {result?.errors && result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">Validation Errors</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.map((error, idx) => (
                      <p key={idx} className="text-xs text-red-700">
                        Row {error.row}: {error.field} - {error.message}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {result?.success && !showDuplicateWarning && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-green-800 mb-1">Upload Successful!</h4>
                  <p className="text-sm text-green-700">{result.message}</p>
                  {result.inserted !== undefined && (
                    <p className="text-xs text-green-600 mt-1">Inserted: {result.inserted} products</p>
                  )}
                  {result.updated !== undefined && (
                    <p className="text-xs text-green-600">Updated: {result.updated} products</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {result && !result.success && !showDuplicateWarning && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 mb-1">Upload Failed</h4>
                  <p className="text-sm text-red-700">{result.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Upload Button */}
          {file && !result?.success && !showDuplicateWarning && (
            <div className="flex space-x-2">
              <Button onClick={() => handleUpload(false)} disabled={isUploading} className="flex-1">
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Validate
                  </>
                )}
              </Button>
              <Button onClick={handleReset} variant="outline" disabled={isUploading}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
