"use client"

import type React from "react"
import { apiFetch } from "@/lib/api-client"
import { SpecsAmazonFetcher } from "../../../components/admin/specs-amazon-fetcher"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Eye, ChevronLeft, ChevronRight, Lock, Unlock, RefreshCw, Plus, Download, Search, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "react-hot-toast"
import { normalizeProductForSchema } from "@/lib/product-schema"

type ExcelRow = {
  sku?: string
  amazon_link?: string
  [key: string]: any
}



interface UploadResult {
  success: number
  failed: number
  skipped: number
  errors: string[]
  message?: string
}

interface ProductSpecification {
  _id: string
  name: string
  sku: string
  mrp?: number // MRP as number
  technical_details?: Record<string, any>
  from_manufacturer?: string
  specification_images?: string[]
  updatedAt?: string
  product_id?: string
  locked?: boolean
  included_components?: string[]
  overview?: string
  features?: string[]
  reviews?: any[]
  category?: string
  subCategory?: string
  isSynced?: boolean
  prod_desc?: string
  manufacturer_name?: string
  group_name?: string
  char_desc?: string
}

export default function ProductSpecificationsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [specifications, setSpecifications] = useState<ProductSpecification[]>([]) // This will now hold SYNCED specs
  const [pendingSpecs, setPendingSpecs] = useState<ProductSpecification[]>([]) // New state for PENDING SYNC specs
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [lockSortAsc, setLockSortAsc] = useState(true)
  const [isLoadingSpecs, setIsLoadingSpecs] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [specSearch, setSpecSearch] = useState("")
  const [lockedSpecs, setLockedSpecs] = useState<ProductSpecification[]>([])
  const [lockedTotal, setLockedTotal] = useState(0)
  const [lockedPage, setLockedPage] = useState(1)
  const [lockedPerPage, setLockedPerPage] = useState(10)
  const [categoryFilter, setCategoryFilter] = useState("")
  const [contentFilter, setContentFilter] = useState("")
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ current: number;
 total: number } | null>(null)
  const [pendingProductCreation, setPendingProductCreation] = useState<{
    spec: any;
    progress: string;
    resolve: (value: 'create' | 'skip') => void;
  } | null>(null)
  const [skuToProductIdMap, setSkuToProductIdMap] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<any[]>([])
  const [allSubCategories, setAllSubCategories] = useState<any[]>([])
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [createForm, setCreateForm] = useState<{
    sku: string
    name: string
    mrp: string
    from_manufacturer: string
    char_desc?: string
    group_name?: string
    prod_desc?: string
    manufacturer_name?: string
    technicalDetails: Array<{ key: string; value: string }>
    images: string[]
    included: string[]
    category: string
    subCategory: string
    showAddImageInput?: boolean
    newImageUrl?: string
  }>({
    sku: '',
    name: '',
    mrp: '',
    from_manufacturer: '',
    char_desc: '',
    group_name: '',
    prod_desc: '',
    technicalDetails: [{ key: '', value: '' }],
    images: [],
    included: [],
    category: '',
    subCategory: '',
    showAddImageInput: false,
    newImageUrl: ''
  })

  const [createManualSpecText, setCreateManualSpecText] = useState('')

  // Fetch categories and subcategories for the dropdowns
  const fetchClassifications = async () => {
    try {
      const [catRes, subRes] = await Promise.all([
        apiFetch("/api/categories"),
        apiFetch("/api/sub-categories")
      ])
      if (catRes.ok) setCategories(await catRes.json())
      if (subRes.ok) setAllSubCategories(await subRes.json())
    } catch (error) {
      console.error("Error fetching classifications:", error)
    }
  }

  // Function to get product details by SKU (returns full product)
  const getProductDetailsBySku = async (sku: string): Promise<any | null> => {
    try {
      const response = await apiFetch(`/api/products/sku/${encodeURIComponent(sku)}`)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error(`Error fetching product details for SKU ${sku}:`, error)
    }
    return null
  }

  // Function to get product ID by SKU
  const getProductIdBySku = async (sku: string): Promise<string | null> => {
    // Check cache first
    if (skuToProductIdMap[sku]) {
      return skuToProductIdMap[sku]
    }

    const product = await getProductDetailsBySku(sku)
    if (product && product._id) {
      // Cache the mapping
      setSkuToProductIdMap(prev => ({ ...prev, [sku]: product._id }))
      return product._id
    }

    return null
  }

  // Function to handle eye icon click
  const handleViewProduct = async (spec: any) => {
    let productId = spec.product_id

    // If no product_id but spec is locked, try to find product by SKU
    if (!productId && spec.locked) {
      productId = await getProductIdBySku(spec.sku)
    }

    if (productId) {
      window.open(`/product/${productId}`, '_blank', 'noopener,noreferrer')
    } else {
      // Fallback to SKU if no product found
      window.open(`/product/${spec.sku}`, '_blank', 'noopener,noreferrer')
    }
  }
  const [editSpec, setEditSpec] = useState<ProductSpecification | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    mrp?: string
    from_manufacturer?: string
    technicalDetails: Array<{ key: string; value: string }>
    images: string[]
    included: string[]
    reviews: any[]
    showAddImageInput?: boolean
    newImageUrl?: string
    category?: string
    subCategory?: string
    prod_desc?: string
    group_name?: string
    char_desc?: string
    manufacturer_name?: string
  }>({ name: '', mrp: '', from_manufacturer: '', technicalDetails: [], images: [], included: [], reviews: [], showAddImageInput: false, newImageUrl: '', category: '', subCategory: '', prod_desc: '', group_name: '', char_desc: '', manufacturer_name: '' })
  const router = useRouter()
  const refreshMessageStorageKey = 'product-specifications-refresh-message'

  const hardRefreshSpecificationsPage = (successMessage?: string) => {
    if (typeof window !== 'undefined') {
      if (successMessage) {
        window.sessionStorage.setItem(refreshMessageStorageKey, successMessage)
      }
      window.location.reload()
      return
    }

    router.refresh()
  }

  useEffect(() => {
    fetchSpecifications(currentPage, specSearch)
    fetchClassifications()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const refreshMessage = window.sessionStorage.getItem(refreshMessageStorageKey)
    if (!refreshMessage) return

    window.sessionStorage.removeItem(refreshMessageStorageKey)
    window.alert(refreshMessage)
  }, [])

  /* New state for manual technical details input */
  const [manualSpecText, setManualSpecText] = useState('')

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchSpecifications(currentPage, specSearch)
    }, 300)
    return () => clearTimeout(debounceTimer)
  }, [currentPage, specSearch, itemsPerPage, categoryFilter, contentFilter, lockedPage, lockedPerPage])

  useEffect(() => {
    apiFetch("/api/admin/taxonomy")
      .then((r) => r.json())
      .then((d) => d?.success && setCategoryOptions(d.categories ?? []))
      .catch(() => {
        /* the filter just stays empty */
      })
  }, [])

  /** Exports every row matching the current search and filters, not just this page. */
  const handleExportFiltered = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '5000', search: specSearch })
      if (categoryFilter) params.set('category', categoryFilter)
      if (contentFilter) params.set('content', contentFilter)

      const res = await apiFetch(`/api/products/specifications?${params}`, { cache: 'no-store' })
      const body = await res.json()
      const rows: any[] = body?.data ?? []
      if (rows.length === 0) {
        toast.error('Nothing matches the current filters')
        return
      }

      const XLSX_LIB = XLSX
      const sheet = rows.map((s) => ({
        'itemno': s.sku ?? '',
        'Name': s.name ?? '',
        'Category/Group Name': s.category ?? '',
        'sub-category/PROD DESC': s.subCategory ?? '',
        'CHAR DESC': s.char_desc ?? '',
        'Manufacturer Name': s.manufacturer_name ?? '',
        'MRP': s.mrp ?? '',
        'Spec fields': s.technical_details ? Object.keys(s.technical_details).length : 0,
        'Images': s.specification_images?.length ?? 0,
        'In the box': s.included_components?.length ?? 0,
        'Features': s.features?.length ?? 0,
        'Brand copy': s.from_manufacturer ? 'Yes' : 'No',
        'Locked': s.locked ? 'Yes' : 'No',
        'Synced': s.isSynced ? 'Yes' : 'No',
        'Last updated': s.updatedAt ? new Date(s.updatedAt).toLocaleString('en-IN') : '',
        'Technical details (JSON)': s.technical_details ? JSON.stringify(s.technical_details) : '',
      }))

      const ws = XLSX_LIB.utils.json_to_sheet(sheet)
      ws['!cols'] = [18, 46, 22, 24, 18, 22, 10, 12, 8, 10, 10, 11, 8, 8, 20, 60].map((wch) => ({ wch }))
      const wb = XLSX_LIB.utils.book_new()
      XLSX_LIB.utils.book_append_sheet(wb, ws, 'Specifications')
      XLSX_LIB.writeFile(wb, `product-specifications_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success(`Exported ${rows.length} specifications`)
    } catch {
      toast.error('Could not build the export')
    } finally {
      setIsExporting(false)
    }
  }

  /* Fetch both pending (unsynced) and synced specifications */
  const fetchSpecifications = async (page = 1, search = '') => {
    try {
      setIsLoadingSpecs(true)
      const cacheBust = Date.now().toString()
      const noStore = {
        cache: 'no-store' as const,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
      const shared: Record<string, string> = { search, t: cacheBust }
      if (categoryFilter) shared.category = categoryFilter
      if (contentFilter) shared.content = contentFilter

      // 1. Editable (unlocked) specifications — the main, paginated table.
      const allParams = new URLSearchParams({
        ...shared,
        page: page.toString(),
        limit: itemsPerPage.toString(),
        locked: 'false',
      })
      const allRes = await apiFetch(`/api/products/specifications?${allParams}`, noStore)
      const allData = await allRes.json()

      if (allData.data) {
        setSpecifications(allData.data)
        setPagination(allData.pagination)
      }

      // 2. Locked specifications — paginated separately from the editable table.
      const lockedParams = new URLSearchParams({
        ...shared,
        page: lockedPage.toString(),
        limit: lockedPerPage.toString(),
        locked: 'true',
      })
      const lockedRes = await apiFetch(`/api/products/specifications?${lockedParams}`, noStore)
      const lockedData = await lockedRes.json()
      if (lockedData.data) {
        setLockedSpecs(lockedData.data)
        setLockedTotal(lockedData.pagination?.total ?? lockedData.data.length)
      }

      // 3. Fetch Pending Synced Specs (Top Table)
      // We always fetch the first page of pending items to show "recently edited"
      // Only show specs edited from today onwards
      const pendingParams = new URLSearchParams({
        ...shared,
        page: '1',
        limit: '100',
        synced: 'false',
      })
      const pendingRes = await apiFetch(`/api/products/specifications?${pendingParams}`, noStore)
      const pendingData = await pendingRes.json()

      if (pendingData.data) {
        // Enrich pending specs with category/subcategory from products database
        const enrichedPending = await Promise.all(
          pendingData.data.map(async (spec: ProductSpecification) => {
            try {
              const productRes = await apiFetch(`/api/products/sku/${encodeURIComponent(spec.sku)}`)
              if (productRes.ok) {
                const product = await productRes.json()
                return {
                  ...spec,
                  category: product.category || spec.category || '',
                  subCategory: product.subCategory || spec.subCategory || ''
                }
              }
            } catch (error) {
              console.error(`Failed to fetch product for SKU ${spec.sku}:`, error)
            }
            return spec
          })
        )
        setPendingSpecs(enrichedPending)
      }

    } catch (error) {
      console.error('Failed to fetch specifications:', error)
    } finally {
      setIsLoadingSpecs(false)
    }
  }

  const openEditModal = async (spec: ProductSpecification) => {
    if (spec.locked) {
      alert('This specification is locked and cannot be edited. Unlock to make changes.')
      return
    }
    setEditSpec(spec)

    // Robust fetch: If category/subcategory or classification fields are missing, try to get them from the product
    let cat = spec.category || ''
    let sub = spec.subCategory || ''
    let pDesc = spec.prod_desc || ''
    let gName = spec.group_name || ''
    let cDesc = spec.char_desc || ''
    let mfgName = spec.manufacturer_name || ''

    if (!cat || !sub || !pDesc || !gName || !cDesc || !mfgName) {
      const product = await getProductDetailsBySku(spec.sku)
      if (product) {
        const normalized = normalizeProductForSchema(product)
        if (!cat) cat = product.category || product.raw?.["ITEM CATEGORY"] || ''
        if (!sub) sub = normalized.subCategoryProdDesc || product.subCategory || ''
        if (!pDesc) pDesc = normalized.subCategoryProdDesc || product.prod_desc || ''
        if (!gName) gName = normalized.categoryGroupName || product.group_name || ''
        if (!cDesc) cDesc = normalized.charDesc || product.char_desc || ''
        if (!mfgName) mfgName = normalized.manufacturerName || product.manufacturer_name || ''
      }
    }

    const techArr: Array<{ key: string; value: string }> = []
    if (spec.technical_details && typeof spec.technical_details === 'object') {
      for (const k of Object.keys(spec.technical_details)) {
        if (k.toLowerCase() === 'mrp' || k === 'Maximum Retail Price') continue;
        const v = spec.technical_details[k]
        techArr.push({ key: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) })
      }
    }

    setEditForm({
      name: spec.name || '',
      mrp: typeof spec.mrp === 'number' ? String(spec.mrp) : (spec.mrp ? String(spec.mrp) : ''),
      from_manufacturer: spec.from_manufacturer || '',
      technicalDetails: techArr.length ? techArr : [{ key: '', value: '' }],
      images: Array.isArray(spec.specification_images) ? spec.specification_images.slice() : [],
      included: Array.isArray(spec.included_components) && spec.included_components.length > 0
        ? spec.included_components
        : (spec.technical_details && spec.technical_details['Included Components']
          ? String(spec.technical_details['Included Components']).split(',').map((s: any) => s.trim()).filter(Boolean)
          : []),
      reviews: spec.reviews || [],
      showAddImageInput: false,
      newImageUrl: '',
      category: cat,
      subCategory: sub,
      prod_desc: pDesc,
      group_name: gName,
      char_desc: cDesc,
      manufacturer_name: mfgName,
    })
  }

  const closeEditModal = () => {
    setEditSpec(null)
  }

  // Create Specification Modal Functions
  const openCreateModal = () => {
    setCreateForm({
      sku: '',
      name: '',
      mrp: '',
      from_manufacturer: '',
      char_desc: '',
      group_name: '',
      prod_desc: '',
      manufacturer_name: '',
      technicalDetails: [{ key: '', value: '' }],
      images: [],
      included: [],
      category: '',
      subCategory: '',
      showAddImageInput: false,
      newImageUrl: ''
    })
    setIsCreateMode(true)
  }

  const closeCreateModal = () => {
    setIsCreateMode(false)
  }

  const handleSaveCreate = async () => {
    if (!createForm.sku.trim()) {
      alert('SKU is required')
      return
    }
    if (!createForm.name.trim()) {
      alert('Name is required')
      return
    }

    try {
      // Build technical_details object from key/value pairs
      const techObj: Record<string, any> = {}
      for (const f of createForm.technicalDetails || []) {
        if (f.key && f.key.trim() !== '') {
          const val = f.value
          try {
            techObj[f.key] = JSON.parse(val)
          } catch {
            techObj[f.key] = val
          }
        }
      }

      // Add included components to technical_details
      if (createForm.included && createForm.included.length > 0) {
        const includedArr = createForm.included.filter(Boolean)
        techObj['Included Components'] = includedArr.join(', ')
      }

      const payload = {
        specifications: [{
          sku: createForm.sku.trim(),
          name: createForm.name.trim(),
          mrp: createForm.mrp ? Number(createForm.mrp) : 0,
          category: createForm.category,
          subCategory: createForm.subCategory,
          char_desc: createForm.char_desc || '',
          group_name: createForm.group_name || '',
          prod_desc: createForm.prod_desc || '',
          manufacturer_name: createForm.manufacturer_name || '',
          technical_details: techObj,
          from_manufacturer: createForm.from_manufacturer || '',
          specification_images: createForm.images.filter(Boolean),
          included_components: createForm.included.filter(Boolean),
        }]
      }

      // If product does not exist, attempt to create it (inactive)
      const existingProduct = await getProductDetailsBySku(createForm.sku.trim())
      if (!existingProduct) {
        const created = await createProduct(payload.specifications[0])
        if (!created.ok) {
          alert(
            `❌ Could not auto-create a product for SKU "${createForm.sku.trim()}".

Reason: ${created.errorMessage || 'Unknown error from product API.'}

Please go to the Products page and create this product manually first, then come back to add the specification.`
          )
          return
        }
      }

      const res = await apiFetch('/api/products/specifications/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()

      if (result.success > 0) {
        alert('Specification created successfully!')
        closeCreateModal()
        window.location.reload()
      } else if (result.skipped > 0) {
        alert(`Creation skipped: ${result.errors?.[0] || 'SKU not found in products. Please create the product first.'}`)
      } else {
        alert(`Creation failed: ${result.errors?.[0] || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('Create error:', error)
      alert('Failed to create specification: ' + error.message)
    }
  }

  const updateCreateTechnicalDetail = (idx: number, field: 'key' | 'value', val: string) => {
    setCreateForm(f => ({
      ...f,
      technicalDetails: f.technicalDetails.map((item, i) => i === idx ? { ...item, [field]: val } : item)
    }))
  }

  const handleSaveEdit = async () => {
    if (!editSpec) return
    try {
      const body: any = {
        name: editForm.name,
        category: editForm.category,
        subCategory: editForm.subCategory,
        prod_desc: editForm.prod_desc || '',
        group_name: editForm.group_name || '',
        char_desc: editForm.char_desc || '',
        manufacturer_name: editForm.manufacturer_name || '',
      }
      if (editForm.mrp !== '') body.mrp = Number(editForm.mrp)
      if (editForm.from_manufacturer) body.from_manufacturer = editForm.from_manufacturer

      // ... rest of logic uses body ...

      // Build technical_details object from key/value pairs
      const techObj: Record<string, any> = {}
      for (const f of editForm.technicalDetails || []) {
        if (f.key && f.key.trim() !== '') {
          // try parse JSON value for complex values, otherwise store string
          const val = f.value
          try {
            techObj[f.key] = JSON.parse(val)
          } catch {
            techObj[f.key] = val
          }
        }
      }
      // Merge Included Components from the separate editor into technical_details AND root field
      if (editForm.included && editForm.included.length > 0) {
        const includedArr = editForm.included.filter(Boolean)
        body.included_components = includedArr

        // Keep synced with technical_details for backward compatibility
        const includedStr = includedArr.join(', ')
        techObj['Included Components'] = includedStr
      } else {
        // If cleared, ensure we clear both
        body.included_components = []
        // techObj['Included Components'] = "" // Optional: deciding whether to keep empty key or remove
      }
      if (Object.keys(techObj).length > 0) body.technical_details = techObj

      if (Array.isArray(editForm.images)) body.specification_images = editForm.images.filter(Boolean)

      const res = await apiFetch(`/api/products/specifications/${encodeURIComponent(editSpec.sku)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Failed to update: ' + (err.error || res.statusText))
        return
      }

      const result = await res.json()

      // If category, subcategory, or classification fields changed, also update the product
      {
        try {
          const productRes = await apiFetch(`/api/products/sku/${encodeURIComponent(editSpec.sku)}`)
          if (productRes.ok) {
            const product = await productRes.json()
            if (product._id) {
              const updateData: any = {}
              if (editForm.category && editForm.category !== product.category) {
                updateData.category = editForm.category
              }
              if (editForm.subCategory && editForm.subCategory !== product.subCategory) {
                updateData.subCategory = editForm.subCategory
              }
              if (editForm.prod_desc !== undefined && editForm.prod_desc !== (product.prod_desc || '')) {
                updateData.prod_desc = editForm.prod_desc
              }
              if (editForm.group_name !== undefined && editForm.group_name !== (product.group_name || '')) {
                updateData.group_name = editForm.group_name
              }
              if (editForm.char_desc !== undefined && editForm.char_desc !== (product.char_desc || '')) {
                updateData.char_desc = editForm.char_desc
              }
              if (editForm.manufacturer_name !== undefined && editForm.manufacturer_name !== (product.manufacturer_name || product.manufacturerName || '')) {
                updateData.manufacturer_name = editForm.manufacturer_name
              }

              if (Object.keys(updateData).length > 0) {
                await apiFetch(`/api/products/${product._id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updateData)
                })
                console.log(`✅ Synced category/subcategory/classification to product ${product._id}`)
              }
            }
          }
        } catch (error) {
          console.error('Failed to sync classification to product:', error)
        }
      }

      closeEditModal()

      alert('Specification updated and synced to product')
      hardRefreshSpecificationsPage()
    } catch (err) {
      console.error('Update error', err)
      alert('Update failed')
    }
  }

  const handleDeleteSpec = async (spec: ProductSpecification) => {
    if (!window.confirm(`Delete specifications for SKU ${spec.sku}? This cannot be undone.`)) return
    try {
      const res = await apiFetch(`/api/products/specifications/${encodeURIComponent(spec.sku)}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Failed to delete: ' + (err.error || res.statusText))
        return
      }
      hardRefreshSpecificationsPage('Specification deleted')
    } catch (err) {
      console.error('Delete error', err)
      alert('Delete failed')
    }
  }

  const toggleLock = async (spec: ProductSpecification) => {
    try {
      const res = await apiFetch(`/api/products/specifications/${encodeURIComponent(spec.sku)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: !spec.locked }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Failed to toggle lock: ' + (err.error || res.statusText))
        return
      }

      const result = await res.json().catch(() => null)
      const nextLocked = result?.data?.locked ?? !spec.locked

      setSpecifications(prev =>
        prev.map(item => item.sku === spec.sku ? { ...item, ...(result?.data || {}), locked: nextLocked } : item)
      )
      setPendingSpecs(prev =>
        prev.map(item => item.sku === spec.sku ? { ...item, ...(result?.data || {}), locked: nextLocked } : item)
      )

      const actionLabel = nextLocked ? 'locked' : 'unlocked'
      hardRefreshSpecificationsPage(`Specifications ${actionLabel}`)
    } catch (err) {
      console.error('Toggle lock error', err)
      alert('Failed to toggle lock')
    }
  }

  const syncCategoryFromProduct = async (spec: ProductSpecification) => {
    try {
      // Fetch product data by SKU
      const productRes = await apiFetch(`/api/products/sku/${encodeURIComponent(spec.sku)}`)
      if (!productRes.ok) {
        alert('Product not found for this SKU')
        return
      }

      const product = await productRes.json()
      const category = product.category || ''
      const subCategory = product.subCategory || ''

      // Update specification with product's category/subcategory
      const res = await apiFetch(`/api/products/specifications/${encodeURIComponent(spec.sku)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category,
          subCategory: subCategory
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Failed to sync category: ' + (err.error || res.statusText))
        return
      }

      // Update local state immediately
      setSpecifications(prev =>
        prev.map(s => s.sku === spec.sku ? { ...s, category, subCategory } : s)
      )
      setPendingSpecs(prev =>
        prev.map(s => s.sku === spec.sku ? { ...s, category, subCategory } : s)
      )

      alert(`Category synced: ${category || 'None'} / ${subCategory || 'None'}`)
    } catch (err) {
      console.error('Sync category error', err)
      alert('Failed to sync category from product')
    }
  }


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setUploadResult(null)
      previewExcelFile(selectedFile)
    }
  }

  // Parse pasted multi-line text like "Key: Value" or "Key\nValue" into key/value objects
  const parseKeyValuePairs = (text: string) => {
    const lines = text.split(/\r?\n/)
    const pairs: Array<{ key: string; value: string }> = []
    let pendingKey: string | null = null

    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue

      // If there's a delimiter in the line, split immediately
      // Prioritize : = and tab as separators so that keys can contain hyphens (e.g. "Wi-Fi: 5G")
      let sepIndex = line.search(/[:=\t]/)

      // Fallback to hyphen if no other separator found, but maybe be stricter? 
      // Current behavior allows any hyphen to split.
      if (sepIndex === -1) {
        sepIndex = line.indexOf('-')
      }

      if (sepIndex !== -1) {
        const key = line.slice(0, sepIndex).trim()
        const value = line.slice(sepIndex + 1).trim()
        if (key && value) {
          pairs.push({ key, value })
          pendingKey = null
          continue
        }
      }

      // Fallback: treat as key on one line, value on next
      if (pendingKey === null) {
        pendingKey = line
      } else {
        const key = pendingKey
        const value = line
        if (key && value) pairs.push({ key, value })
        pendingKey = null
      }
    }
    return pairs
  }

  /* Removed normalizeTechnicalDetails to prevent auto-adding/removing rows which caused issues with "extra record space" and editing flow */
  // const normalizeTechnicalDetails = ... 

  const updateTechnicalDetail = (idx: number, field: 'key' | 'value', newValue: string) => {
    setEditForm((f) => {
      const technicalDetails = (f.technicalDetails || []).map((t, i) =>
        i === idx ? { ...t, [field]: newValue } : t,
      )
      // Removed normalization call to prevent auto-adding empty row
      return { ...f, technicalDetails }
    })
  }

  const handleProcessManualSpecs = () => {
    const text = manualSpecText
    const parsed = parseKeyValuePairs(text)
    if (!parsed.length) return

    setEditForm((f) => {
      // Keep existing rows that have content (or are being edited), append parsed rows
      // We do NOT add an empty row automatically here.
      const existing = (f.technicalDetails || [])
      return { ...f, technicalDetails: [...existing, ...parsed] }
    })

    // Clear the input
    setManualSpecText('')
  }

  const handleProcessCreateManualSpecs = () => {
    const text = createManualSpecText
    const parsed = parseKeyValuePairs(text)
    if (!parsed.length) return

    setCreateForm((f) => {
      const existing = (f.technicalDetails || [])
      return { ...f, technicalDetails: [...existing, ...parsed] }
    })

    setCreateManualSpecText('')
  }


  const previewExcelFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Preview data:", jsonData.slice(0, 5))
        setPreviewData(jsonData.slice(0, 5))
      } catch (error) {
        console.error("ByteWise Testing Point Error reading Excel file:", error)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: "binary" })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[]

          // Validate columns
          const missing = []
          if (!jsonData[0]?.sku) missing.push("sku")
          if (!jsonData[0]?.amazon_link) missing.push("amazon_link")
          if (missing.length) {
            setUploadResult({
              success: 0,
              failed: jsonData.length,
              skipped: 0,
              errors: [`Missing columns: ${missing.join(", ")}`],
            })
            setIsUploading(false)
            return
          }

          // Bulk fetch from /api/scrape-amazon
          let success = 0, failed = 0, errors: string[] = []
          // Optionally: throttle requests if you expect a lot of rows
          await Promise.all(
            jsonData.map(async (row: any) => {
              try {
                const res = await apiFetch("/api/scrape-amazon", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    itemno: row.sku, // API expects itemno
                    url: row.amazon_link,
                    saveToDatabase: true
                  }),
                })
                if (!res.ok) {
                  failed++
                  const err = await res.json().catch(() => ({}))
                  errors.push(`SKU ${row.sku}: ${err.error || "Failed"}`)
                } else {
                  success++
                }
              } catch (err) {
                failed++
                errors.push(`SKU ${row.sku}: ${err instanceof Error ? err.message : "Unknown error"}`)
              }
            })
          )

          setUploadResult({
            success,
            failed,
            skipped: 0,
            errors,
            message: `Processed ${jsonData.length} rows.`,
          })

          // Refresh the specifications list
          if (success > 0) await fetchSpecifications()
        } catch (error) {
          setUploadResult({
            success: 0,
            failed: 0,
            skipped: 0,
            errors: [error instanceof Error ? error.message : "Unknown error occurred"],
          })
        } finally {
          setIsUploading(false)
        }
      }
      reader.readAsBinaryString(file)
    } catch (error) {
      setUploadResult({
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : "Unknown error occurred"],
      })
      setIsUploading(false)
    }
  }

  // Helper function to prompt user for product creation
  const promptProductCreation = (spec: any, progress: string): Promise<'create' | 'skip'> => {
    return new Promise((resolve) => {
      setPendingProductCreation({ spec, progress, resolve });
    });
  };

  // Helper function to create a new product
  const createProduct = async (spec: any): Promise<{ ok: boolean; errorMessage?: string }> => {
    try {
      const productName = spec.name || `Product ${spec.sku}`
      // Category = Group Name, Sub-Category = PROD DESC (use as fallback for each other)
      const resolvedCategory = (() => {
        const catName = spec.category || 'Uncategorized'
        const match = categories.find(c =>
          (c.name || '').trim().toLowerCase() === catName.trim().toLowerCase() ||
          (c.id || '').trim().toLowerCase() === catName.trim().toLowerCase()
        )
        return match ? match.name : catName
      })()
      const resolvedSubCategory = spec.subCategory || ''
      // group_name = Category if not explicitly set; prod_desc = Sub-Category if not explicitly set
      const resolvedGroupName = spec.group_name || resolvedCategory
      const resolvedProdDesc = spec.prod_desc || resolvedSubCategory

      const productData = {
        name: productName,
        sku: spec.sku,
        // Use prod_desc → sub-category → name as fallback so description is never empty (API requires it)
        description: resolvedProdDesc || spec.description || productName,
        char_desc: spec.char_desc || '',
        groupName: resolvedGroupName,   // camelCase – matches products API
        prod_desc: resolvedProdDesc,
        price: spec.price || (spec.printedprice ? spec.printedprice.replace(/[₹, ]/g, '') : '') || (spec.mrp ? String(spec.mrp) : '0'),
        stock: 0,
        images: Array.isArray(spec.specification_images) ? spec.specification_images.slice(0, 4) : [],
        category: resolvedCategory,
        subCategory: resolvedSubCategory,
        featured: false,
        active: false,
      }

      const createRes = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      })

      if (createRes.ok) {
        console.log(`✅ Created new product for SKU ${spec.sku}`)
        return { ok: true }
      }

      // Read the actual error from the API response
      let apiError = `HTTP ${createRes.status}`
      try {
        const errBody = await createRes.json()
        apiError = errBody.error || errBody.message || apiError
      } catch {
        // ignore parse error
      }
      console.error(`Create failed for SKU ${spec.sku}: ${apiError}`)
      return { ok: false, errorMessage: apiError }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Error creating product for SKU ${spec.sku}:`, error)
      return { ok: false, errorMessage: msg }
    }
  }

  const handleSyncToProducts = async () => {
    console.log("[Product Specs] 🔄 Sync to products requested")
    if (!window.confirm("Are you sure you want to sync specifications to products? This will update product details.")) {
      console.log("[Product Specs] ❌ Sync cancelled by user")
      return;
    }

    console.log("[Product Specs] 🚀 Starting sync process...")
    setIsUploading(true);
    setUploadResult(null);

    try {

      // Filter only those that are NOT synced (pending specs)
      // Since we fetch explicitly `synced=false` specs now, we can iterate over that provided list 
      // OR we can fetch fresh from backend like before but filter

      // Let's rely on fetching `synced=false` from API to be sure we get the latest
      console.log("[Product Specs] 📡 Fetching pending specifications for sync...")
      const pendingParams = new URLSearchParams({ page: '1', limit: '500', synced: 'false' });
      const pendingRes = await apiFetch(`/api/products/specifications?${pendingParams}`);
      const pendingDataRaw = await pendingRes.json();
      const specs = pendingDataRaw.data || [];

      console.log("[Product Specs] ✅ Total pending specifications to sync:", specs.length)
      console.log("[Product Specs] ✅ Total fetched specifications:", specs.length)
      console.log("[Product Specs] 📊 First 2 specs:", specs.slice(0, 2))

      let success = 0, failed = 0, errors: string[] = [];
      const totalSpecs = specs.length;

      console.log(`[Product Specs] 🔄 Starting sync for ${totalSpecs} specifications...`);
      setSyncProgress({ current: 0, total: totalSpecs });

      // Update each product
      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        const progress = `[${i + 1}/${totalSpecs}]`;

        // Update progress
        setSyncProgress({ current: i + 1, total: totalSpecs });

        // Use itemNo if available, otherwise fallback to sku
        const productId = spec.itemNo || spec.sku;

        try {
          console.log(`${progress} Processing itemNo/SKU: ${productId || 'MISSING_ID'}`);

          if (!productId) {
            failed++;
            const errorMsg = `${progress} Invalid specification: Missing itemNo and SKU`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
            continue; // Continue to next item
          }

          // Helper function to clean "NA" values
          const cleanValue = (value: any): string => {
            if (!value) return "";
            const str = String(value).trim();
            // Remove quotes and check for NA variations
            const cleaned = str.replace(/^["']|["']$/g, '');
            if (cleaned.toUpperCase() === 'NA' || cleaned === '') return "";
            return cleaned;
          };

          // Prepare the update data - Copy name to name field
          const cleanedDescription = cleanValue(spec.description);
          const cleanedName = cleanValue(spec.name);
          const cleanedCategory = cleanValue(spec.category);
          const cleanedSubCategory = cleanValue(spec.subCategory);

          // Do NOT include any price-related fields (price, mrp, printedprice) when syncing
          // Filter and clean image URLs - remove empty/invalid URLs
          const cleanedImages = Array.isArray(spec.specification_images)
            ? spec.specification_images
              .filter((img: any) => img && typeof img === 'string' && img.trim() !== '' && img.trim().toLowerCase() !== 'na')
              .slice(0, 4)
            : [];

          const updateData = {
            name: cleanedName || cleanedDescription || "", // Copy name to name (fallback to description if name is empty)
            description: cleanedDescription || "",
            images: cleanedImages, // Use cleaned and filtered images
            image: cleanedImages.length > 0 ? cleanedImages[0] : undefined, // Set main image (singular) for product cards

            category: (() => {
              if (!cleanedCategory) return "";
              const match = categories.find(c =>
                (c.name || '').trim().toLowerCase() === cleanedCategory.trim().toLowerCase() ||
                (c.id || '').trim().toLowerCase() === cleanedCategory.trim().toLowerCase()
              );
              return match ? match.name : cleanedCategory;
            })(),
            subCategory: cleanedSubCategory,
          };

          // Log detailed spec data for debugging
          console.log(`[Product Specs] 📦 ${progress} Raw spec data:`, {
            itemNo: spec.itemNo,
            sku: spec.sku,
            rawDescription: spec.description?.substring(0, 100) || 'N/A',
            rawName: spec.name?.substring(0, 50) || 'N/A',
            rawPrice: 'REDACTED',
            rawImages: spec.specification_images || 'NO_IMAGES',
            rawImagesType: typeof spec.specification_images,
            rawImagesLength: Array.isArray(spec.specification_images) ? spec.specification_images.length : 0
          })

          console.log(`[Product Specs] 📦 ${progress} Cleaned data:`, {
            cleanedDescription: cleanedDescription?.substring(0, 100) || 'EMPTY',
            cleanedName: cleanedName?.substring(0, 50) || 'EMPTY'
          })

          console.log(`[Product Specs] 📦 ${progress} Cleaned images:`, {
            before: spec.specification_images,
            after: cleanedImages,
            count: cleanedImages.length
          });

          console.log(`[Product Specs] 📦 ${progress} Update data:`, {
            itemNo: spec.itemNo,
            sku: spec.sku,
            name: updateData.name?.substring(0, 100) || 'EMPTY',
            nameLength: updateData.name?.length || 0,
            price: 'UNCHANGED',
            imageCount: updateData.images.length,
            images: updateData.images // Log actual image URLs for debugging
          })

          // Skip if name is empty after cleaning (no valid data to sync)
          if (!updateData.name || updateData.name.trim() === '') {
            console.warn(`⚠️ ${progress} SKIPPING: Name is empty after cleaning for itemNo/SKU ${productId}!`)
            console.warn(`⚠️ ${progress} Raw description: "${spec.description}", Raw name: "${spec.name}"`)
            failed++;
            errors.push(`${progress} itemNo/SKU ${productId}: Skipped - No valid name/description (only "NA" values found)`);
            continue; // Skip this product
          }

          console.log(`[Product Specs] 📡 ${progress} Sending PUT to /api/products/sku/${productId}`)
          const updateRes = await apiFetch(`/api/products/sku/${encodeURIComponent(productId)}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
          });
          console.log(`[Product Specs] 📥 ${progress} Response status:`, updateRes.status)

          let result;
          try {
            result = await updateRes.json();
          } catch (parseError) {
            throw new Error(`Invalid response from server for itemNo/SKU ${productId}`);
          }

          if (!updateRes.ok) {
            // Check if product not found
            if (updateRes.status === 404 || (result.error && result.error.includes('not found'))) {
              console.log(`⚠️ ${progress} Product not found for itemNo/SKU ${productId}`);
              failed++;
              const errorMsg = `${progress} itemNo/SKU ${productId}: Product not found in database (Status: 404) - Description: "${spec.description?.substring(0, 50) || 'N/A'}"`;
              errors.push(errorMsg);
              console.error(`❌ ${errorMsg}`);

              // Don't prompt for creation during bulk sync - just log the error
              // User can create products manually if needed
            } else {
              // Other error - provide detailed error message
              failed++;
              const errorDetails = result.details || result.error || "Unknown error";
              const errorMsg = `${progress} itemNo/SKU ${productId}: ${errorDetails} (Status: ${updateRes.status}) - Description: "${spec.description?.substring(0, 50) || 'N/A'}"`;
              errors.push(errorMsg);
              console.error(`❌ ${errorMsg}`);
              console.error(`❌ ${progress} Full error response:`, result);
            }
          } else {
            success++;

            // Mark as synced in DB
            try {
              await apiFetch(`/api/products/specifications/${encodeURIComponent(spec.sku)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isSynced: true }) // Update sync status
              });
              console.log(`✅ ${progress} Marked SKU ${productId} as synced`);
            } catch (syncUpdateErr) {
              console.error(`⚠️ ${progress} Failed to update sync status for ${productId}`, syncUpdateErr);
            }

            const updatedProduct = result;
            console.log(`✅ ${progress} Successfully updated itemNo/SKU ${productId}`);
            console.log(`✅ ${progress} Updated name: "${updatedProduct.name?.substring(0, 100) || 'N/A'}"`);
            console.log(`✅ ${progress} Updated images:`, updatedProduct.images || []);

            // Verify the name was actually updated
            if (!updatedProduct.name || updatedProduct.name.trim() === '') {
              console.warn(`⚠️ ${progress} WARNING: Product updated but name is still empty!`);
            }

            // Verify images were actually updated
            if (updateData.images.length > 0) {
              if (!updatedProduct.images || updatedProduct.images.length === 0) {
                console.warn(`⚠️ ${progress} WARNING: Sent ${updateData.images.length} images but product has none!`);
              } else if (updatedProduct.images.length !== updateData.images.length) {
                console.warn(`⚠️ ${progress} WARNING: Image count mismatch! Sent: ${updateData.images.length}, Got: ${updatedProduct.images.length}`);
              } else {
                console.log(`✅ ${progress} Images verified: ${updatedProduct.images.length} images successfully updated`);
              }
            }
          }
        } catch (err) {
          failed++;
          const errorMsg = `${progress} itemNo/SKU ${productId || 'UNKNOWN'}: ${err instanceof Error ? err.message : "Unknown error"}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`, err);
          // Continue to next item even if this one threw an error
        }
      }

      console.log(`✅ Sync completed: ${success} success, ${failed} failed out of ${totalSpecs} total`);
      console.log(`📊 Error summary:`, errors);

      setSyncProgress(null); // Clear progress

      setUploadResult({
        success,
        failed,
        skipped: 0,
        errors,
        message: `Synced ${success} products successfully, ${failed} failed.`,
      });

      // Show detailed alert with results
      if (failed > 0) {
        const errorSummary = errors.slice(0, 10).join('\n');
        const moreErrors = errors.length > 10 ? `\n\n... and ${errors.length - 10} more errors. Check console for full details.` : '';
        alert(
          `Sync Complete!\n\n` +
          `✅ Success: ${success}\n` +
          `❌ Failed: ${failed}\n\n` +
          `Failed Items:\n${errorSummary}${moreErrors}\n\n` +
          `Check the browser console (F12) for detailed logs.`
        );
      } else {
        alert(`✅ Sync Complete!\n\nSuccessfully synced ${success} products.`);
      }

      // Refresh the specifications list
      if (success > 0) {
        await fetchSpecifications();
      }

    } catch (error) {
      console.error("Sync error:", error);
      setUploadResult({
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : "An unknown error occurred"],
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Download mandatory specification columns as an Excel file
  const handleExportRequiredData = async () => {
    try {
      setIsUploading(true);
      const res = await apiFetch('/api/products/specifications/export');
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `product_specifications_mandatory_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error', err);
      alert('Failed to export specifications');
    } finally {
      setIsUploading(false);
    }
  }

  // Download all specifications as an Excel file
  const handleDownloadExcel = async () => {
    try {
      if (process.env.NODE_ENV === "development") console.log("[Product Specs] 📡 Downloading specifications for Excel export")
      const res = await apiFetch('/api/products/specifications')
      if (!res.ok) {
        throw new Error('Failed to fetch specifications')
      }
      const specs = await res.json()

      const rows = (specs || []).map((s: any) => ({
        sku: s.sku || '',
        name: s.name || '',
        mrp: s.mrp ?? '',
        from_manufacturer: s.from_manufacturer || '',
        technical_details: s.technical_details ? JSON.stringify(s.technical_details) : '',
        specification_images: Array.isArray(s.specification_images) ? s.specification_images.join(',') : (s.specification_images || ''),
        product_id: s.product_id || '',
        locked: s.locked ? 'true' : 'false',
        updatedAt: s.updatedAt || '',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'product_specifications')
      const filename = `product_specifications_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err) {
      console.error('Download error', err)
      alert('Failed to download specifications')
    }
  }

  // Pagination logic - data is now filtered and paginated on server
  const currentItems = specifications

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
    // Fetch will be triggered by useEffect dependency change
  }

  // Sorting logic for lock column
  const sortedSpecifications = [...specifications].sort((a, b) => {
    if (a.locked === b.locked) return 0;
    if (lockSortAsc) {
      // unlocked first
      return a.locked ? 1 : -1;
    } else {
      // locked first
      return a.locked ? -1 : 1;
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Specifications</h1>
            <p className="text-gray-600">
              Manage product specifications. Create, edit, and sync specifications to products.
            </p>
          </div>
          <div className="flex gap-3">

            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-md"
            >
              <Plus className="h-5 w-5" />
              Add new product
            </button>
          </div>
        </div>

        {/* Instructions Card - Updated */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            How to Use
          </h2>
          <ul className="list-disc list-inside text-blue-800 space-y-2 text-sm">
            <li>
              <strong>Create Specification:</strong> Click the button above to manually create a new product specification
            </li>
            <li>
              <strong>Edit:</strong> Click the edit button on any specification to modify its details
            </li>
            <li>
              <strong>Lock/Unlock:</strong> Lock specifications to prevent accidental changes
            </li>
            <li>
              <strong>Sync:</strong> Use the sync button to push specifications to the main products database
            </li>
          </ul>
        </div>

        {/* Hidden: Fetch from Amazon form - commented out per user request */}
        {/* <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <SpecsAmazonFetcher />
        </div> */}

        {/* Hidden: Upload Card - commented out per user request */}
        {/* <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" id="file-upload" />
            <label
              htmlFor="file-upload"
              className="cursor-pointer inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-5 w-5" />
              Choose Excel File
            </label>
            {file && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Selected file:</p>
                <p className="font-medium text-gray-900">{file.name}</p>
              </div>
            )}
          </div>

          {file && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-colors ${isUploading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
                  }`}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Upload Specifications
                  </>
                )}
              </button>
            </div>
          )}
        </div> */}

        {/* Preview Data */}
        {previewData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Preview (First 5 rows)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((value: any, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {typeof value === "object" ? JSON.stringify(value).substring(0, 50) + "..." : String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload Results</h2>
            {uploadResult.message && <p className="text-sm text-gray-600 mb-4">{uploadResult.message}</p>}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-900">{uploadResult.success}</p>
                <p className="text-sm text-green-700">Successful</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-900">{uploadResult.skipped}</p>
                <p className="text-sm text-yellow-700">Skipped</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-900">{uploadResult.failed}</p>
                <p className="text-sm text-red-700">Failed</p>
              </div>
            </div>

            {uploadResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-red-900">
                    Errors ({uploadResult.errors.length}):
                  </h3>
                  <button
                    onClick={() => {
                      const errorText = uploadResult.errors.join('\n\n');
                      navigator.clipboard.writeText(errorText);
                      alert('Errors copied to clipboard!');
                    }}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                  >
                    Copy All Errors
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <ul className="list-none text-sm text-red-800 space-y-2">
                    {uploadResult.errors.map((error, idx) => (
                      <li key={idx} className="border-b border-red-200 pb-2 last:border-b-0">
                        <span className="font-mono text-xs bg-red-100 px-2 py-1 rounded mr-2">
                          #{idx + 1}
                        </span>
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-red-700 mt-3 italic">
                  💡 Tip: Open browser console (F12) for detailed logs and debugging information.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pending (Recently Edited) Specifications Table */}
        {pendingSpecs.length > 0 && (
          <div className="bg-amber-50 rounded-lg shadow-md p-6 mb-6 border border-amber-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Pending / Recently Edited (Today)
                </h2>
                <p className="text-sm text-amber-700">Items edited today that are not yet synced to products.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchSpecifications(currentPage, specSearch)}
                  className="bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
                  title="Refresh Pending List"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  onClick={handleSyncToProducts}
                  disabled={isUploading}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  {isUploading ? "Syncing..." : "Sync Pending to Products"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-amber-200 bg-white rounded-lg overflow-hidden">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider" title="Category/SubCategory from Products DB (synced in real-time)">
                      Category (Live from Products)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingSpecs.map((spec) => (
                    <tr key={spec._id} className="hover:bg-amber-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate" title={spec.name}>
                        {spec.name || <span className="text-gray-400 italic">No Name</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{spec.sku}</td>
                      <td className="px-4 py-3 text-sm text-gray-500" title="Category and SubCategory fetched from Products database">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-green-600">🔄</span>
                          <span>{spec.category || '-'}/{spec.subCategory || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <div className="flex gap-2">
                          {/* Lock Button (for pending specs, maybe irrelevant, but consistency) */}
                          <button
                            onClick={() => toggleLock(spec)}
                            className="text-gray-400 hover:text-yellow-600"
                            title={spec.locked ? 'Unlock' : 'Lock'}
                          >
                            {spec.locked ? <Lock className="h-4 w-4 text-yellow-500" /> : <Unlock className="h-4 w-4" />}
                          </button>

                          {/* View Product (if linked) */}
                          {(spec.product_id) ? (
                            <button
                              onClick={() => handleViewProduct(spec)}
                              className="text-blue-600 hover:text-blue-800"
                              title="View Product"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          ) : (
                            <button disabled className="text-gray-300 cursor-not-allowed"><Eye className="h-4 w-4" /></button>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(spec)}
                            className={`text-indigo-600 hover:text-indigo-800 ${spec.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={spec.locked}
                            title="Edit"
                          >
                            Edit
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteSpec(spec)}
                            className={`text-red-600 hover:text-red-800 ${spec.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={spec.locked}
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Shared search, filters and export for both specification tables */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[240px] flex-1">
              <label htmlFor="spec-search" className="mb-1 block text-xs font-semibold text-gray-700">
                Search
              </label>
              <Search className="pointer-events-none absolute left-3 top-[30px] h-4 w-4 text-gray-400" />
              <input
                id="spec-search"
                type="text"
                placeholder="Name, SKU or description…"
                value={specSearch}
                onChange={(e) => { setSpecSearch(e.target.value); setCurrentPage(1); setLockedPage(1); }}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="spec-cat" className="mb-1 block text-xs font-semibold text-gray-700">
                Category
              </label>
              <select
                id="spec-cat"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); setLockedPage(1); }}
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="">All categories</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="spec-content" className="mb-1 block text-xs font-semibold text-gray-700">
                Content
              </label>
              <select
                id="spec-content"
                value={contentFilter}
                onChange={(e) => { setContentFilter(e.target.value); setCurrentPage(1); setLockedPage(1); }}
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="">Any</option>
                <option value="complete">Has specifications</option>
                <option value="empty">Missing specifications</option>
                <option value="noImages">Missing images</option>
              </select>
            </div>

            <button
              onClick={() => fetchSpecifications(currentPage, specSearch)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>

            <button
              onClick={handleExportFiltered}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Excel
            </button>

            {(specSearch || categoryFilter || contentFilter) && (
              <button
                onClick={() => { setSpecSearch(""); setCategoryFilter(""); setContentFilter(""); setCurrentPage(1); setLockedPage(1); }}
                className="text-sm font-semibold text-gray-500 hover:text-gray-800"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Applies to both tables below. Export includes every matching row, not just this page.
          </p>
        </div>

        {/* Specifications Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between items-start mb-4 gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <h2 className="text-xl font-semibold">Editable specifications</h2>
              <span className="text-sm text-gray-500" suppressHydrationWarning>
                {isLoadingSpecs ? 'Loading...' : `${pagination.total} unlocked`}
              </span>
            </div>
          </div>

          {isLoadingSpecs ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : specifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p>No specifications uploaded yet</p>
              <p className="text-sm mt-2">Upload an Excel file to get started</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" title="Category and sub-category, kept in step with the Products table">
                        Classification
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Content
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Updated
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => setLockSortAsc((v) => !v)}
                        title="Sort by lock status"
                      >
                        Lock
                        <span className="ml-1 align-middle">
                          {lockSortAsc ? (
                            <svg className="inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                          ) : (
                            <svg className="inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          )}
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Apply sorting, then pagination (filtering is done on server)
                      const sorted = currentItems.sort((a: any, b: any) => {
                        if (a.locked === b.locked) return 0;
                        if (lockSortAsc) {
                          return a.locked ? 1 : -1;
                        } else {
                          return a.locked ? -1 : 1;
                        }
                      });
                      const paginated = sorted;
                      return paginated.map((spec: any) => {
                        const specCount = spec.technical_details ? Object.keys(spec.technical_details).length : 0
                        const imageCount = spec.specification_images?.length ?? 0
                        const includedCount = spec.included_components?.length ?? 0
                        const featureCount = spec.features?.length ?? 0
                        return (
                        <tr key={spec._id} className="hover:bg-gray-50 align-top">
                          <td className="px-4 py-3">
                            <p className="line-clamp-2 max-w-sm text-sm font-medium text-gray-900" title={spec.name}>
                              {spec.name || <span className="text-gray-400">Unnamed</span>}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-gray-500">{spec.sku}</p>
                          </td>

                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-start gap-1.5">
                              <div className="min-w-0">
                                <p className="truncate text-gray-900" title={spec.category}>
                                  {spec.category || <span className="text-gray-400">Category not set</span>}
                                </p>
                                <p className="truncate text-xs text-gray-500" title={spec.subCategory}>
                                  {spec.subCategory || <span className="text-gray-400">Sub-category not set</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => syncCategoryFromProduct(spec)}
                                className="mt-0.5 shrink-0 rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                                title="Pull category and sub-category from the product record"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {specCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  {specCount} specs
                                </span>
                              )}
                              {imageCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                                  {imageCount} images
                                </span>
                              )}
                              {includedCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                                  {includedCount} in box
                                </span>
                              )}
                              {featureCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                                  {featureCount} features
                                </span>
                              )}
                              {spec.from_manufacturer && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                  Brand copy
                                </span>
                              )}
                              {specCount === 0 && imageCount === 0 && includedCount === 0 && !spec.from_manufacturer && (
                                <span className="text-xs text-gray-400">Empty — nothing to show on the product page</span>
                              )}
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {spec.updatedAt ? new Date(spec.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleLock(spec)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
                              title={spec.locked ? 'Unlock specifications' : 'Lock specifications'}
                            >
                              {spec.locked ? <Lock className="h-4 w-4 text-yellow-700" /> : <Unlock className="h-4 w-4 text-gray-400" />}
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleViewProduct(spec)}
                                disabled={!spec.product_id && !spec.locked}
                                className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="View product page"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(spec)}
                                disabled={spec.locked}
                                className="rounded-lg px-2 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title={spec.locked ? 'Locked — cannot edit' : 'Edit specifications'}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteSpec(spec)}
                                disabled={spec.locked}
                                className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title={spec.locked ? 'Locked — cannot delete' : 'Delete specifications'}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage >= pagination.totalPages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage >= pagination.totalPages
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage >= pagination.totalPages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${currentPage >= pagination.totalPages
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}</span>
                      {' '}-{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{pagination.total}</span> results
                    </p>

                    {/* Rows per page selector */}
                    <div className="flex items-center gap-2">
                      <label htmlFor="rowsPerPage" className="text-sm text-gray-700">
                        Rows per page:
                      </label>
                      <select
                        id="rowsPerPage"
                        value={pagination.limit}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="rounded-md border-gray-300 py-1 pl-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center rounded-l-md px-2 py-2
                          ${currentPage === 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      {(() => {
                        // Smart pagination - show limited page numbers
                        const maxVisiblePages = 7
                        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
                        let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1)

                        // Adjust if we're near the end
                        if (endPage - startPage < maxVisiblePages - 1) {
                          startPage = Math.max(1, endPage - maxVisiblePages + 1)
                        }

                        return (
                          <>
                            {startPage > 1 && (
                              <>
                                <button
                                  onClick={() => paginate(1)}
                                  className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                >
                                  1
                                </button>
                                {startPage > 2 && (
                                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700">
                                    ...
                                  </span>
                                )}
                              </>
                            )}

                            {[...Array(endPage - startPage + 1)].map((_, index) => {
                              const pageNum = startPage + index
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => paginate(pageNum)}
                                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold
                                    ${currentPage === pageNum
                                      ? 'z-10 bg-blue-600 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                      : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                  {pageNum}
                                </button>
                              )
                            })}

                            {endPage < pagination.totalPages && (
                              <>
                                {endPage < pagination.totalPages - 1 && (
                                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700">
                                    ...
                                  </span>
                                )}
                                <button
                                  onClick={() => paginate(pagination.totalPages)}
                                  className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                >
                                  {pagination.totalPages}
                                </button>
                              </>
                            )}
                          </>
                        )
                      })()}
                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === pagination.totalPages}
                        className={`relative inline-flex items-center rounded-r-md px-2 py-2
                          ${currentPage === pagination.totalPages
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sync Button */}
        {/* <div className="flex justify-end mb-4">
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleSyncToProducts}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  Syncing...
                </>
              ) : (
                'Sync All to Products'
              )}
            </button>
            {syncProgress && (
              <div className="w-64">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Processing: {syncProgress.current} / {syncProgress.total}</span>
                  <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div> */}

        {/* Locked specifications — read-only until unlocked */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Lock className="h-5 w-5 text-yellow-700" />
              Locked specifications
            </h2>
            <span className="text-sm text-gray-500" suppressHydrationWarning>
              {isLoadingSpecs ? 'Loading…' : `${lockedTotal} locked`}
            </span>
            <span className="text-xs text-gray-500">
              Locked sheets cannot be edited or deleted here. Saving the product still updates them.
            </span>
          </div>

          {lockedSpecs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              {specSearch || categoryFilter || contentFilter
                ? 'No locked specifications match the current filters.'
                : 'Nothing is locked.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-yellow-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-yellow-900">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-yellow-900">Classification</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-yellow-900">Content</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-yellow-900">Updated</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-yellow-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {lockedSpecs.map((spec: any) => {
                    const specCount = spec.technical_details ? Object.keys(spec.technical_details).length : 0
                    const imageCount = spec.specification_images?.length ?? 0
                    return (
                      <tr key={spec._id} className="align-top hover:bg-yellow-50/40">
                        <td className="px-4 py-3">
                          <p className="line-clamp-2 max-w-sm text-sm font-medium text-gray-900" title={spec.name}>
                            {spec.name || <span className="text-gray-400">Unnamed</span>}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-gray-500">{spec.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p className="truncate text-gray-900">{spec.category || <span className="text-gray-400">Not set</span>}</p>
                          <p className="truncate text-xs text-gray-500">{spec.subCategory || <span className="text-gray-400">Not set</span>}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {specCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">{specCount} specs</span>
                            )}
                            {imageCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">{imageCount} images</span>
                            )}
                            {specCount === 0 && imageCount === 0 && (
                              <span className="text-xs text-gray-400">Empty</span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {spec.updatedAt ? new Date(spec.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleViewProduct(spec)}
                              className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                              title="View product page"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toggleLock(spec)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100"
                              title="Unlock to allow editing"
                            >
                              <Unlock className="h-4 w-4" />
                              Unlock
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lockedTotal > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <label htmlFor="lockedPerPage">Rows</label>
                <select
                  id="lockedPerPage"
                  value={lockedPerPage}
                  onChange={(e) => { setLockedPerPage(Number(e.target.value)); setLockedPage(1) }}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-gray-500">
                  {(lockedPage - 1) * lockedPerPage + 1}–{Math.min(lockedPage * lockedPerPage, lockedTotal)} of {lockedTotal}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLockedPage((p) => Math.max(1, p - 1))}
                  disabled={lockedPage === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="px-2 text-sm text-gray-600">
                  Page {lockedPage} of {Math.max(1, Math.ceil(lockedTotal / lockedPerPage))}
                </span>
                <button
                  onClick={() => setLockedPage((p) => (p < Math.ceil(lockedTotal / lockedPerPage) ? p + 1 : p))}
                  disabled={lockedPage >= Math.ceil(lockedTotal / lockedPerPage)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Product Creation Modal */}
        {pendingProductCreation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Product Not Found
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {pendingProductCreation.progress} Product with SKU <strong>{pendingProductCreation.spec.sku}</strong> does not exist.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">Product Details:</p>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p><strong>Name:</strong> {pendingProductCreation.spec.name || 'N/A'}</p>
                    <p><strong>SKU:</strong> {pendingProductCreation.spec.sku}</p>
                    <p><strong>Price:</strong> ₹{pendingProductCreation.spec.price || pendingProductCreation.spec.mrp || 'N/A'}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  Would you like to create this product or skip it?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const resolve = pendingProductCreation.resolve;
                    setPendingProductCreation(null);
                    resolve('skip');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => {
                    const resolve = pendingProductCreation.resolve;
                    setPendingProductCreation(null);
                    resolve('create');
                  }}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  Create Product
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Specification Modal */}
        {editSpec && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Edit specification</h3>
                  <p className="text-xs text-gray-500">
                    SKU <span className="font-mono font-semibold text-gray-700">{editSpec.sku}</span>
                  </p>
                </div>
                <button
                  onClick={closeEditModal}
                  className="rounded-lg p-1 text-2xl leading-none text-gray-400 hover:bg-gray-200 hover:text-red-600 focus:outline-none"
                  title="Close"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-4">
                <div className="grid grid-cols-1 gap-3">
                  <label className="text-sm">Name</label>
                  <input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} className="border rounded p-2" />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm">Category/Group Name</label>
                        <button
                          onClick={async () => {
                            const p = await getProductDetailsBySku(editSpec.sku)
                            if (p) {
                              const fetchedCat = p.category || p.raw?.["ITEM CATEGORY"]
                              if (fetchedCat) setEditForm(f => ({ ...f, category: fetchedCat }))
                            }
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Fetch from Product
                        </button>
                      </div>
                      <select
                        value={editForm.category || ''}
                        onChange={(e) => setEditForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full border rounded p-2"
                      >
                        <option value="">-- Select Category --</option>
                        {categories.map((cat: any, idx: number) => (
                          <option key={cat._id || cat.id || idx} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm">sub-category/PROD DESC</label>
                        <button
                          onClick={async () => {
                            const p = await getProductDetailsBySku(editSpec.sku)
                            if (p) {
                              const fetchedSub = normalizeProductForSchema(p).subCategoryProdDesc || p.subCategory
                              if (fetchedSub) setEditForm(f => ({ ...f, subCategory: fetchedSub }))
                            }
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Fetch from Product
                        </button>
                      </div>
                      <select
                        value={editForm.subCategory || ''}
                        onChange={(e) => setEditForm(f => ({ ...f, subCategory: e.target.value }))}
                        className="w-full border rounded p-2"
                      >
                        <option value="">-- Select Sub-Category --</option>
                        {/* If current value is not in the list, add it as an option so it's visible */}
                        {editForm.subCategory && !allSubCategories.find(s => s.name === editForm.subCategory) && (
                          <option value={editForm.subCategory}>{editForm.subCategory} (Current)</option>
                        )}
                        {allSubCategories
                          .map((sub: any, idx: number) => (
                            <option key={sub._id || sub.id || idx} value={sub.name}>{sub.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* These were previously hidden while still being submitted as
                      empty strings, which silently blanked them on every save. */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">MRP (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.mrp}
                        onChange={(e) => setEditForm(f => ({ ...f, mrp: e.target.value }))}
                        placeholder="e.g. 38999"
                        className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">PROD DESC</label>
                        <button
                          type="button"
                          onClick={async () => {
                            const p = await getProductDetailsBySku(editSpec.sku)
                            const val = p?.prod_desc || p?.raw?.["PROD DESC"] || ''
                            if (val) setEditForm(f => ({ ...f, prod_desc: val }))
                            else alert('No PROD DESC on the product record')
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Fetch from product
                        </button>
                      </div>
                      <input
                        value={editForm.prod_desc}
                        onChange={(e) => setEditForm(f => ({ ...f, prod_desc: e.target.value }))}
                        placeholder="Enter PROD DESC"
                        className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Group Name</label>
                        <button
                          type="button"
                          onClick={async () => {
                            const p = await getProductDetailsBySku(editSpec.sku)
                            const val = p?.group_name || p?.raw?.["Group Name"] || ''
                            if (val) setEditForm(f => ({ ...f, group_name: val }))
                            else alert('No Group Name on the product record')
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Fetch from product
                        </button>
                      </div>
                      <input
                        value={editForm.group_name}
                        onChange={(e) => setEditForm(f => ({ ...f, group_name: e.target.value }))}
                        placeholder="Enter Group Name"
                        className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm">PROD DESC</label>
                        <button
                          onClick={async () => {
                            const p = await getProductDetailsBySku(editSpec.sku)
                            if (p) {
                              const val = p.prod_desc || p.raw?.["PROD DESC"] || ''
                              if (val) setEditForm(f => ({ ...f, prod_desc: val }))
                              else alert('No PROD DESC found in product')
                            }
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Fetch from Product
                        </button>
                      </div>
                      <input
                        value={editForm.prod_desc || ''}
                        onChange={(e) => setEditForm(f => ({ ...f, prod_desc: e.target.value }))}
                        placeholder="Enter PROD DESC"
                        className="w-full border rounded p-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm">Group Name</label>
                        <button
                          onClick={async () => {
                            const p = await getProductDetailsBySku(editSpec.sku)
                            if (p) {
                              const val = p.group_name || p.raw?.["Group Name"] || ''
                              if (val) setEditForm(f => ({ ...f, group_name: val }))
                              else alert('No Group Name found in product')
                            }
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Fetch from Product
                        </button>
                      </div>
                      <input
                        value={editForm.group_name || ''}
                        onChange={(e) => setEditForm(f => ({ ...f, group_name: e.target.value }))}
                        placeholder="Enter Group Name"
                        className="w-full border rounded p-2"
                      />
                    </div> */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm">CHAR DESC</label>
                        <button
                          onClick={async () => {
                            const p = await getProductDetailsBySku(editSpec.sku)
                            if (p) {
                              const val = normalizeProductForSchema(p).charDesc || p.char_desc || ''
                              if (val) setEditForm(f => ({ ...f, char_desc: val }))
                              else alert('No CHAR DESC found in product')
                            }
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Fetch from Product
                        </button>
                      </div>
                      <input
                        value={editForm.char_desc || ''}
                        onChange={(e) => setEditForm(f => ({ ...f, char_desc: e.target.value }))}
                        placeholder="Enter CHAR DESC"
                        className="w-full border rounded p-2"
                      />
                    </div>
                  </div>

                  {/* Manufacturer Name */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-medium">Manufacturer Name</label>
                      <button
                        onClick={async () => {
                          const p = await getProductDetailsBySku(editSpec.sku)
                          if (p) {
                            const val = normalizeProductForSchema(p).manufacturerName || p.manufacturer_name || ''
                            if (val) setEditForm(f => ({ ...f, manufacturer_name: val }))
                            else alert('No Manufacturer Name found in product')
                          }
                        }}
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        Fetch from Product
                      </button>
                    </div>
                    <input
                      value={editForm.manufacturer_name || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, manufacturer_name: e.target.value }))}
                      placeholder="Enter manufacturer name"
                      className="w-full border rounded p-2"
                    />
                  </div>

                  <label className="text-sm">From Manufacturer</label>
                  <textarea
                    value={editForm.from_manufacturer}
                    onChange={(e) => setEditForm(f => ({ ...f, from_manufacturer: e.target.value }))}
                    className="border rounded p-2 min-h-[120px]"
                  />

                  <label className="text-sm">Technical Details</label>
                  <div className="space-y-2 border rounded p-3 max-h-[28vh] overflow-auto">
                    {(editForm.technicalDetails || []).map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <input
                          placeholder="Key"
                          value={field.key}
                          onChange={(e) => updateTechnicalDetail(idx, 'key', e.target.value)}
                          className="w-1/3 border rounded p-2 text-sm"
                        />
                        <input
                          placeholder="Value (string or JSON)"
                          value={field.value}
                          onChange={(e) => updateTechnicalDetail(idx, 'value', e.target.value)}
                          className="flex-1 border rounded p-2 text-sm font-mono"
                        />
                        <button
                          onClick={() => setEditForm(f => ({ ...f, technicalDetails: f.technicalDetails.filter((_, i) => i !== idx) }))}
                          className="text-red-600 hover:text-red-800 px-2 py-1"
                          title="Remove field"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Enter technical details (key: value)</label>
                      <textarea
                        value={manualSpecText}
                        onChange={(e) => setManualSpecText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault()
                            handleProcessManualSpecs()
                          }
                        }}
                        placeholder={"Example:\nColor: Red\nModel = ABC123\n\nPaste multiple lines and click 'Add' or press Ctrl+Enter"}
                        className="w-full border rounded p-2 text-sm h-20"
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">Supports separators: colon (:), equals (=), tab.</p>
                        <button
                          onClick={handleProcessManualSpecs}
                          disabled={!manualSpecText.trim()}
                          className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Add to List
                        </button>
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => setEditForm(f => ({ ...f, technicalDetails: [...(f.technicalDetails || []), { key: '', value: '' }] }))}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        + Add Field
                      </button>
                    </div>
                  </div>

                  <label className="text-sm">Images</label>
                  <div className="border rounded p-3">
                    <div className="flex flex-wrap gap-3">
                      {(editForm.images || []).map((img: string, idx) => (
                        <div key={idx} className="relative">
                          <img src={img} alt={`img-${idx}`} className="h-16 w-16 object-cover rounded-md border" />
                          <button
                            onClick={() => setEditForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                            className="absolute -top-2 -right-2 bg-white rounded-full shadow text-red-600 p-1"
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      {!editForm.showAddImageInput ? (
                        <button onClick={() => setEditForm(f => ({ ...f, showAddImageInput: true }))} className="text-sm text-blue-600 hover:text-blue-800">+ Add Image</button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <input
                            placeholder="Paste image URL"
                            value={editForm.newImageUrl || ''}
                            onChange={(e) => setEditForm(f => ({ ...f, newImageUrl: e.target.value }))}
                            className="border rounded p-2 text-sm w-full"
                          />
                          <button
                            onClick={() => {
                              if (!editForm.newImageUrl) return alert('Please paste image URL')
                              setEditForm(f => ({ ...f, images: [...f.images, f.newImageUrl || ''], newImageUrl: '', showAddImageInput: false }))
                            }}
                            className="px-3 py-2 bg-emerald-600 text-white rounded"
                          >Add</button>
                          <button onClick={() => setEditForm(f => ({ ...f, showAddImageInput: false, newImageUrl: '' }))} className="px-3 py-2 bg-gray-200 rounded">Cancel</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <label className="text-sm">What's Included</label>
                  <div className="border rounded p-3">
                    <div className="space-y-2">
                      {(editForm.included || []).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            value={item}
                            onChange={(e) => setEditForm(f => ({ ...f, included: f.included.map((it, i) => i === idx ? e.target.value : it) }))}
                            className="flex-1 border rounded p-2 text-sm"
                          />
                          <button
                            onClick={() => setEditForm(f => ({ ...f, included: f.included.filter((_, i) => i !== idx) }))}
                            className="text-red-600 hover:text-red-800 px-2 py-1"
                            title="Remove included item"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div>
                        <button
                          onClick={() => setEditForm(f => ({ ...f, included: [...(f.included || []), ''] }))}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          + Add Included Item
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* REVIEWS SECTION */}
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Customer Reviews ({editForm.reviews?.length || 0})</label>
                    <div className="border rounded p-3 bg-gray-50 max-h-48 overflow-y-auto">
                      {editForm.reviews && editForm.reviews.length > 0 ? (
                        <div className="space-y-3">
                          {editForm.reviews.map((rev: any, idx: number) => (
                            <div key={idx} className="pb-2 border-b last:border-b-0 border-gray-200">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-xs text-gray-800 truncate pr-2">{rev.title || 'Review'}</span>
                                <span className="text-amber-500 text-xs shrink-0">★ {rev.rating}</span>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-2">{rev.text || rev.body}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic text-center py-2">No reviews found. Try re-transferring.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              </div>
              <div className="flex gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button onClick={closeEditModal} className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-lg font-semibold">Cancel</button>
                <button onClick={handleSaveEdit} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">Save changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Create Specification Modal */}
        {isCreateMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add a specification</h3>
                  <p className="text-xs text-gray-500">
                    The SKU must already exist in Products.
                  </p>
                </div>
                <button
                  onClick={closeCreateModal}
                  className="rounded-lg p-1 text-2xl leading-none text-gray-400 hover:bg-gray-200 hover:text-red-600 focus:outline-none"
                  title="Close"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-4">
                <div className="grid grid-cols-1 gap-3">

                  {/* SKU - Required */}
                  <div>
                    <label className="text-sm font-medium">SKU <span className="text-red-500">*</span></label>
                    <input
                      value={createForm.sku}
                      onChange={(e) => setCreateForm(f => ({ ...f, sku: e.target.value }))}
                      placeholder="Enter product SKU (must match existing product)"
                      className="w-full border rounded p-2 mt-1"
                    />
                  </div>

                  {/* Name - Required */}
                  <div>
                    <label className="text-sm font-medium">Name <span className="text-red-500">*</span></label>
                    <input
                      value={createForm.name}
                      onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Product name"
                      className="w-full border rounded p-2 mt-1"
                    />
                  </div>

                  {/* PROD DESC, Group Name, CHAR DESC */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* <div>
                      <label className="text-sm font-medium">PROD DESC</label>
                      <input
                        value={createForm.prod_desc || ''}
                        onChange={(e) => setCreateForm(f => ({ ...f, prod_desc: e.target.value }))}
                        placeholder="Product description"
                        className="w-full border rounded p-2 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Group Name</label>
                      <input
                        value={createForm.group_name || ''}
                        onChange={(e) => setCreateForm(f => ({ ...f, group_name: e.target.value }))}
                        placeholder="Group name"
                        className="w-full border rounded p-2 mt-1"
                      />
                    </div> */}
                    <div>
                      <label className="text-sm font-medium">CHAR DESC</label>
                      <input
                        value={createForm.char_desc || ''}
                        onChange={(e) => setCreateForm(f => ({ ...f, char_desc: e.target.value }))}
                        placeholder="CHAR DESC"
                        className="w-full border rounded p-2 mt-1"
                      />
                    </div>
                  </div>

                  {/* Manufacturer Name */}
                  <div>
                    <label className="text-sm font-medium">Manufacturer Name</label>
                    <input
                      value={createForm.manufacturer_name || ''}
                      onChange={(e) => setCreateForm(f => ({ ...f, manufacturer_name: e.target.value }))}
                      placeholder="Enter manufacturer name"
                      className="w-full border rounded p-2 mt-1"
                    />
                  </div>

                  {/* Category and Sub-Category */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Category/Group Name</label>
                      <select
                        value={createForm.category || ''}
                        onChange={(e) => setCreateForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full border rounded p-2 mt-1"
                      >
                        <option value="">-- Select Category --</option>
                        {categories.map((cat: any, idx: number) => (
                          <option key={cat._id || cat.id || idx} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">sub-category/PROD DESC</label>
                      <select
                        value={createForm.subCategory || ''}
                        onChange={(e) => setCreateForm(f => ({ ...f, subCategory: e.target.value }))}
                        className="w-full border rounded p-2 mt-1"
                      >
                        <option value="">-- Select Sub-Category --</option>
                        {allSubCategories.map((sub: any, idx: number) => (
                          <option key={sub._id || sub.id || idx} value={sub.name}>{sub.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* MRP - hidden in Create modal per request */}

                  {/* Overview (was 'From Manufacturer') */}
                  <div>
                    <label className="text-sm font-medium">Overview</label>
                    <input
                      value={createForm.from_manufacturer}
                      onChange={(e) => setCreateForm(f => ({ ...f, from_manufacturer: e.target.value }))}
                      placeholder="Overview / short description"
                      className="w-full border rounded p-2 mt-1"
                    />
                  </div>

                  {/* Technical Details */}
                  <div>
                    <label className="text-sm font-medium">Technical Details</label>
                    <div className="space-y-2 border rounded p-3 mt-1 max-h-[28vh] overflow-auto">
                      {(createForm.technicalDetails || []).map((field, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <input
                            placeholder="Key"
                            value={field.key}
                            onChange={(e) => updateCreateTechnicalDetail(idx, 'key', e.target.value)}
                            className="w-1/3 border rounded p-2 text-sm"
                          />
                          <input
                            placeholder="Value"
                            value={field.value}
                            onChange={(e) => updateCreateTechnicalDetail(idx, 'value', e.target.value)}
                            className="flex-1 border rounded p-2 text-sm font-mono"
                          />
                          <button
                            onClick={() => setCreateForm(f => ({ ...f, technicalDetails: f.technicalDetails.filter((_, i) => i !== idx) }))}
                            className="text-red-600 hover:text-red-800 px-2 py-1"
                            title="Remove field"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600">Enter technical details (key: value)</label>
                        <textarea
                          value={createManualSpecText}
                          onChange={(e) => setCreateManualSpecText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault()
                              handleProcessCreateManualSpecs()
                            }
                          }}
                          placeholder={"Example:\nColor: Red\nModel = ABC123\n\nPaste multiple lines and click 'Add' or press Ctrl+Enter"}
                          className="w-full border rounded p-2 text-sm h-20"
                        />
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-gray-500">Supports separators: colon (:), equals (=), tab.</p>
                          <button
                            onClick={handleProcessCreateManualSpecs}
                            disabled={!createManualSpecText.trim()}
                            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Add to List
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => setCreateForm(f => ({ ...f, technicalDetails: [...(f.technicalDetails || []), { key: '', value: '' }] }))}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        + Add Field
                      </button>
                    </div>
                  </div>

                  {/* Images */}
                  <div>
                    <label className="text-sm font-medium">Images</label>
                    <div className="border rounded p-3 mt-1">
                      <div className="flex flex-wrap gap-3">
                        {(createForm.images || []).map((img: string, idx) => (
                          <div key={idx} className="relative">
                            <img src={img} alt={`img-${idx}`} className="h-16 w-16 object-cover rounded-md border" />
                            <button
                              onClick={() => setCreateForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                              className="absolute -top-2 -right-2 bg-white rounded-full shadow text-red-600 p-1"
                              title="Remove image"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        {!createForm.showAddImageInput ? (
                          <button onClick={() => setCreateForm(f => ({ ...f, showAddImageInput: true }))} className="text-sm text-blue-600 hover:text-blue-800">+ Add Image</button>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <input
                              placeholder="Paste image URL"
                              value={createForm.newImageUrl || ''}
                              onChange={(e) => setCreateForm(f => ({ ...f, newImageUrl: e.target.value }))}
                              className="border rounded p-2 text-sm w-full"
                            />
                            <button
                              onClick={() => {
                                if (!createForm.newImageUrl) return alert('Please paste image URL')
                                setCreateForm(f => ({ ...f, images: [...f.images, f.newImageUrl || ''], newImageUrl: '', showAddImageInput: false }))
                              }}
                              className="px-3 py-2 bg-emerald-600 text-white rounded"
                            >Add</button>
                            <button onClick={() => setCreateForm(f => ({ ...f, showAddImageInput: false, newImageUrl: '' }))} className="px-3 py-2 bg-gray-200 rounded">Cancel</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* What's Included */}
                  <div>
                    <label className="text-sm font-medium">What's Included</label>
                    <div className="border rounded p-3 mt-1">
                      <div className="space-y-2">
                        {(createForm.included || []).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              value={item}
                              onChange={(e) => setCreateForm(f => ({ ...f, included: f.included.map((it, i) => i === idx ? e.target.value : it) }))}
                              className="flex-1 border rounded p-2 text-sm"
                              placeholder="Item included"
                            />
                            <button
                              onClick={() => setCreateForm(f => ({ ...f, included: f.included.filter((_, i) => i !== idx) }))}
                              className="text-red-600 hover:text-red-800 px-2 py-1"
                              title="Remove"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setCreateForm(f => ({ ...f, included: [...(f.included || []), ''] }))}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          + Add Included Item
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              </div>
              <div className="flex gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button onClick={closeCreateModal} className="flex-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-lg font-semibold">Cancel</button>
                <button onClick={handleSaveCreate} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">Create specification</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
