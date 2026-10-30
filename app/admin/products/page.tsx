"use client"

import { apiFetch } from "@/lib/api-client"
import { buildActiveProductPriceSheet, fetchAllAdminProducts, type AdminProductResponse } from "@/lib/admin-products-client"
import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Edit,
  Trash,
  Eye,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Database,
  Trash2,
  AlertCircle,
  RefreshCw,
  Filter,
  Upload,
  DollarSign,
  Shield,
  FileSpreadsheet,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { useAuth } from "@/contexts/AuthContext"
import ExcelUpload from "@/components/ExcelUpload"
import { normalizeProductForSchema } from "@/lib/product-schema"
import {
  METADATA_SHEET_COLUMNS,
  METADATA_SHEET_FIELDS,
  metadataSheetRowFromProduct,
  type MetadataSheetField,
  type MetadataSheetRow,
} from "@/lib/product-metadata-sheet"

interface Product {
  id: string
  slug?: string
  name: string
  price: number
  mrp?: number
  stock: number
  image?: string
  category?: string
  groupName?: string
  itemCategory?: string
  manufacturerName?: string
  color?: string
  // Division → Category → Segment is the merchandising hierarchy; `brand` is
  // curated separately from the category and the manufacturer.
  division?: string
  segment?: string
  brand?: string
  subCategory?: string
  capacity?: string
  ean?: string
  active?: boolean
  trusted?: boolean
  updatedAt?: string
  raw?: {
    "Item No."?: string
    "Old Item Model"?: string
    Manufacturer?: string
    "Manufacturer Name"?: string
    Color?: string
    "Capacity Description"?: string
    "EAN Number"?: string
    "Tax Category"?: string
    "ITEM CATEGORY"?: string
    [key: string]: unknown
  }
}

interface Category {
  id: string
  name: string
  description?: string
}

type ProductApiResponse = AdminProductResponse

interface PricePreview {
  sku: string
  name: string
  mrp: number | null
  oldPrice: number | null
  newPrice: number
  newMrp: number | null
  status: string
  error?: string
}

interface MetadataPreview extends MetadataSheetRow {
  currentName?: string
  status: string
  error?: string
}

function normalizeAdminProduct(product: ProductApiResponse): Product {
  const canonical = normalizeProductForSchema(product)
  const raw = product?.raw || {}

  return {
    ...product,
    id: product.id,
    name: canonical.name || "Unnamed Product",
    price: Number(product?.price ?? 0),
    mrp: product?.mrp,
    stock: Number(product?.stock ?? 0),
    image: product?.image || product?.images?.[0] || "/placeholder.svg?height=40&width=40",
    category:
      product?.category ||
      canonical.categoryGroupName ||
      product?.groupName ||
      product?.itemCategory ||
      raw["ITEM CATEGORY"],
    groupName: product?.groupName || canonical.categoryGroupName,
    itemCategory: product?.itemCategory || raw["ITEM CATEGORY"],
    manufacturerName:
      product?.manufacturerName ||
      canonical.manufacturerName ||
      product?.manufacturer_name,
    division: canonical.division,
    segment: canonical.segment,
    brand: canonical.brandName,
    subCategory: product?.subCategory || canonical.subCategoryProdDesc || product?.prod_desc,
    ean: product?.ean || raw["EAN Number"],
    updatedAt: product?.updatedAt,
  }
}

/** The columns the table can sort by, and how to read each one off a product. */
const COLUMN_VALUES = {
  name: (product: Product) => product.name || "",
  division: (product: Product) => product.division || "",
  category: (product: Product) =>
    normalizeProductForSchema(product).categoryGroupName || product.category || product.groupName || product.itemCategory || "",
  subCategory: (product: Product) => product.subCategory || "",
  segment: (product: Product) => product.segment || "",
  brand: (product: Product) => product.brand || "",
  price: (product: Product) => Number(product.price ?? 0),
  mrp: (product: Product) => Number(product.mrp ?? 0),
  stock: (product: Product) => Number(product.stock ?? 0),
  active: (product: Product) => (product.active ?? true ? 1 : 0),
  updatedAt: (product: Product) => (product.updatedAt ? new Date(product.updatedAt).getTime() : 0),
} satisfies Record<string, (product: Product) => string | number>

type SortColumn = keyof typeof COLUMN_VALUES

/** Table columns in display order; every one of them sorts. */
const TABLE_COLUMNS: Array<{ field: SortColumn; label: string; align?: "right" }> = [
  { field: "name", label: "Product" },
  { field: "division", label: "Division" },
  { field: "category", label: "Category" },
  { field: "segment", label: "Segment" },
  { field: "brand", label: "Brand" },
  { field: "price", label: "Price", align: "right" },
  { field: "mrp", label: "MRP", align: "right" },
  { field: "stock", label: "Stock", align: "right" },
  { field: "active", label: "Status" },
]

/**
 * A column heading that sorts and says so.
 *
 * The arrow is directional on the active column and neutral elsewhere, so the
 * current sort is readable at a glance rather than having to be inferred from
 * the rows.
 */
function SortableHeader({
  label,
  align,
  active,
  direction,
  onSort,
}: {
  label: string
  align?: "right"
  active: boolean
  direction: "asc" | "desc"
  onSort: () => void
}) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-gray-900" : "text-gray-500"}`}
    >
      <button
        type="button"
        onClick={onSort}
        className={`flex w-full items-center gap-1 uppercase hover:text-gray-900 ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        {label}
        <Icon className="h-3 w-3 shrink-0" />
      </button>
    </th>
  )
}

/**
 * Columns in the upload preview, labelled with the spreadsheet headers the
 * operator sees in their own file rather than our internal field names.
 *
 * Derived from the sheet contract so the preview cannot show a column the
 * uploader does not actually read.
 */
const METADATA_PREVIEW_COLUMNS: Array<{ field: MetadataSheetField; label: string }> =
  METADATA_SHEET_FIELDS.map((field) => ({ field, label: METADATA_SHEET_COLUMNS[field] }))

/**
 * What each column means to the operator filling it in.
 *
 * The three taxonomy levels are described by where they sit relative to one
 * another, because the warehouse export names them one level below where they
 * read and an operator going by the ERP's own labels files them wrongly.
 */
const METADATA_SHEET_DESCRIPTIONS: Record<MetadataSheetField, string> = {
  itemno: "Product SKU (required, used to match)",
  name: "Product name",
  division: "Top level of the menu",
  category: "Sits under the division",
  segment: "Sits under the category",
  brand: "Product brand",
}

/** A taxonomy label, or a visible gap where one has not been assigned yet. */
function TaxonomyCell({ value }: { value?: string }) {
  const label = (value || "").trim()
  return (
    <td className="px-4 py-3">
      {label ? (
        <p className="truncate text-sm text-gray-900" title={label}>
          {label}
        </p>
      ) : (
        <span className="text-sm text-gray-300">—</span>
      )}
    </td>
  )
}

/** Distinct values for a dropdown, sorted and case-folded. */
function distinctValues(products: Product[], read: (product: Product) => string): string[] {
  const seen = new Map<string, string>()
  for (const product of products) {
    const value = read(product).trim()
    if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

function getNormalizedCategoryName(product: Product) {
  return normalizeProductForSchema(product).categoryGroupName || product.category || product.groupName || product.itemCategory || ""
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [activeProductsCount, setActiveProductsCount] = useState<number>(0)
  const [allProductsLoaded, setAllProductsLoaded] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all")
  const [selectedDivision, setSelectedDivision] = useState<string>("all")
  const [selectedSegment, setSelectedSegment] = useState<string>("all")
  const [selectedBrand, setSelectedBrand] = useState<string>("all")
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "out">("all")
  const [filterActiveStatus, setFilterActiveStatus] = useState<"all" | "active" | "inactive">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "failed">("checking")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortColumn>("updatedAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const { user, isLoading: authLoading, canAccessAdmin } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [priceUpdateFile, setPriceUpdateFile] = useState<File | null>(null)
  const [googleSheetId, setGoogleSheetId] = useState(process.env.NEXT_PUBLIC_GOOGLE_SHEET_PRICE_SYNC_ID || "")
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false)
  const [priceUpdateResult, setPriceUpdateResult] = useState<{
    success: number;

    failed: number;
    errors: string[];
  } | null>(null)
  const [previewData, setPreviewData] = useState<PricePreview[] | null>(null)
  const [pricePreviewPage, setPricePreviewPage] = useState(1)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isPriceExporting, setIsPriceExporting] = useState(false)
  const [updatingActiveIds, setUpdatingActiveIds] = useState<string[]>([])
  const [updatingDivision, setUpdatingDivision] = useState(false)
  const [activatingAll, setActivatingAll] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)

  // Metadata update modal state
  const [showMetadataUpdateModal, setShowMetadataUpdateModal] = useState(false)
  const [metadataUpdateFile, setMetadataUpdateFile] = useState<File | null>(null)
  const [metadataPreviewData, setMetadataPreviewData] = useState<MetadataPreview[] | null>(null)
  const [isMetadataUpdating, setIsMetadataUpdating] = useState(false)
  const [metadataUpdateResult, setMetadataUpdateResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null)

  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    name: 250,
    sku: 120,
    mrp: 100,
    category: 150,
    price: 100,
    stock: 80,
    manufacturer: 150,
    color: 100,
    capacity: 120,
    actions: 120
  })

  // Keep admin search local to this page only.

  useEffect(() => {
    checkDatabaseConnection()
  }, [])

  useEffect(() => {
    if (connectionStatus === "connected") {
      fetchCategories()
      fetchSubCategories()
      // sub-categories will be derived from the products collection (using raw['PROD DESC'])
      // after `fetchProducts` runs and sets `products`.
    }
  }, [connectionStatus])

  const fetchSubCategories = async () => {
    console.log('[Admin Products] 📡 Fetching /api/sub-categories...')
    try {
      const res = await apiFetch('/api/sub-categories')
      if (!res.ok) {
        console.error('[Admin Products] ❌ Failed to fetch sub-categories', res.status)
        return
      }
      const data: Category[] = await res.json()
      setSubCategories(data)
      console.log('[Admin Products] ✅ Sub-categories fetched:', data.length)
    } catch (err) {
      console.error('[Admin Products] ❌ Error fetching sub-categories:', err)
    }
  }

  // useEffect(() => {
  //   if (connectionStatus === "connected" && categories.length > 0 && selectedCategory === "all") {
  //     const firstCategory = categories[0]
  //     if (firstCategory) {
  //       setSelectedCategory(firstCategory.id)
  //     }
  //   }
  // }, [categories, connectionStatus])

  useEffect(() => {
    if (connectionStatus === "connected" && selectedCategory) {
      fetchProducts()
    }
  }, [selectedCategory, connectionStatus])

  useEffect(() => {
    // reset to first page when subcategory changes
    setCurrentPage(1)
  }, [selectedSubCategory])

  const checkDatabaseConnection = async () => {
    console.log("[Admin Products] 🔍 Starting database connection check...")
    try {
      console.log("[Admin Products] 📡 Fetching /api/health...")
      const response = await apiFetch("/api/health")
      console.log("[Admin Products] 📥 Response status:", response.status)

      const result = await response.json()
      console.log("[Admin Products] 📦 Response data:", result)

      if (response.ok && result.status === "connected") {
        setConnectionStatus("connected")
        console.log("[Admin Products] ✅ Database connection successful")
      } else {
        setConnectionStatus("failed")
        setError(`Database connection failed: ${result.error || "Unknown error"}`)
        console.error("[Admin Products] ❌ Database connection failed:", result)
      }
    } catch (err) {
      setConnectionStatus("failed")
      setError(`Connection test failed: ${err instanceof Error ? err.message : "Unknown error"}`)
      console.error("[Admin Products] ❌ Connection test exception:", err)
    }
  }

  const fetchCategories = async () => {
    console.log("[Admin Products] 🏷️ Starting fetchCategories...")
    setIsCategoriesLoading(true)
    try {
      // Fetch unique categories directly from products data (category column from metadata)
      console.log("[Admin Products] 📡 Fetching unique categories from products...")
      const [productsData, categoriesResponse] = await Promise.all([
        fetchAllAdminProducts(),
        apiFetch("/api/categories")
      ])
      const normalizedProducts = productsData.map(normalizeAdminProduct)

      // Get category lookup map (id -> name) from categories collection
      const categoryLookup: Record<string, string> = {}
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        categoriesData.forEach((cat: Category) => {
          categoryLookup[cat.id] = cat.name
        })
      }

      // Extract unique category values from products (resolve IDs to names)
      const uniqueCategories = Array.from(
        new Set(
          normalizedProducts
            .map((p: Product) => {
              const rawCategory = getNormalizedCategoryName(p)
              // If it looks like an ObjectId (24 hex chars), try to resolve it
              if (rawCategory && /^[a-f0-9]{24}$/i.test(rawCategory)) {
                return categoryLookup[rawCategory] || rawCategory
              }
              return rawCategory
            })
            .filter(Boolean)
        )
      ) as string[]

      // Convert to Category format with id = name for direct matching
      const categoriesFromProducts = uniqueCategories.map((name: string) => ({
        id: name,
        name: name
      }))

      console.log("[Admin Products] ✅ Categories extracted from products:", categoriesFromProducts.length, "categories")
      console.log("[Admin Products] 📋 Categories data:", categoriesFromProducts)
      setCategories(categoriesFromProducts)

      // previously setSelectedCategory(data[0].id)
    } catch (err) {
      console.error("[Admin Products] ❌ Error fetching categories:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch categories")
    } finally {
      setIsCategoriesLoading(false)
      console.log("[Admin Products] 🏁 fetchCategories completed")
    }
  }

  // Fetch all products once, then paginate/filter client-side like the public products page.
  const fetchProducts = async () => {
    console.log("[Admin Products] 📦 Starting fetchProducts...")
    setIsLoading(true)
    setError(null)
    setAllProductsLoaded(false)

    try {
      const allData = await fetchAllAdminProducts()
      const normalizedAllData = allData.map(normalizeAdminProduct)
      setProducts(normalizedAllData)

      try {
        setActiveProductsCount(normalizedAllData.filter((p: Product) => p.active !== false).length)
      } catch (e) {
        setActiveProductsCount(0)
      }
      setAllProductsLoaded(true)

      try {
        const names = Array.from(
          new Set(
            normalizedAllData
              .map((p: Product) => normalizeProductForSchema(p).subCategoryProdDesc)
              .filter(Boolean)
          )
        )
        const normalized = names.map((name) => ({ id: name, name }))
        setSubCategories(normalized)
        console.log('[Admin Products] ✅ Derived sub-categories from products:', normalized.length)
      } catch (e) {
        setSubCategories([])
      }

      setConnectionStatus("connected")
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setConnectionStatus("failed")
      setProducts([])
      setIsLoading(false)
    }
  }

  const handleCategoryChange = (categoryId: string) => {
    console.log("[Admin Products] 🔗 Category changed to:", categoryId)
    setSelectedCategory(categoryId)
    // reset subcategory filter when category changes
    setSelectedSubCategory('all')
  }

  const handleDelete = async (id: string) => {
    console.log("[Admin Products] 🗑️ Delete requested for product ID:", id)
    if (!window.confirm("Are you sure you want to delete this product?")) {
      console.log("[Admin Products] ❌ Delete cancelled by user")
      return
    }

    try {
      console.log("[Admin Products] 📡 Sending DELETE request to /api/products/", id)
      const response = await apiFetch(`/api/products/${id}`, {
        method: "DELETE",
      })
      console.log("[Admin Products] 📥 Delete response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[Admin Products] ❌ Delete failed:", errorData)
        throw new Error(errorData.details || errorData.error || "Failed to delete product")
      }

      console.log("[Admin Products] ✅ Product deleted successfully")
      // Refresh products list
      console.log("[Admin Products] 🔄 Refreshing products list...")
      fetchProducts()
      alert("Product deleted successfully")
    } catch (err) {
      console.error("[Admin Products] ❌ Error deleting product:", err)
      alert(err instanceof Error ? err.message : "Failed to delete product")
    }
  }

  const handleToggleActive = async (id: string, newValue: boolean) => {
    console.log(`[Admin Products] 🔁 Toggling active for ${id} ->`, newValue)
    setUpdatingActiveIds((s) => [...s, id])
    try {
      const res = await apiFetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || data.message || "Failed to update product")
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active: newValue } : p)))
      toast.success(`Product ${newValue ? "activated" : "deactivated"} successfully`)
    } catch (err) {
      console.error("[Admin Products] ❌ Error toggling active:", err)
      toast.error(err instanceof Error ? err.message : "Failed to update product visibility")
    } finally {
      setUpdatingActiveIds((s) => s.filter((x) => x !== id))
    }
  }

  const handleToggleDivision = async (division: string, newValue: boolean) => {
    const affectedCount = products.filter(
      product => (product.division || "").trim().toLowerCase() === division.trim().toLowerCase(),
    ).length
    const action = newValue ? "activate" : "deactivate"
    if (!window.confirm(
      `${action === "activate" ? "Activate" : "Deactivate"} all ${affectedCount} products in "${division}"?`
    )) return

    setUpdatingDivision(true)
    try {
      const response = await apiFetch("/api/products/division-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ division, active: newValue }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to update division")

      const next = products.map(product =>
        (product.division || "").trim().toLowerCase() === division.trim().toLowerCase()
          ? { ...product, active: newValue }
          : product
      )
      setProducts(next)
      setActiveProductsCount(next.filter(product => product.active === true).length)
      toast.success(`Division ${newValue ? "activated" : "deactivated"} (${data.matchedCount} products)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update division")
    } finally {
      setUpdatingDivision(false)
    }
  }

  const handleToggleTrusted = async (id: string, newValue: boolean) => {
    console.log(`[Admin Products] ⭐ Toggling trusted for ${id} ->`, newValue)
    try {
      const res = await apiFetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trusted: newValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || data.message || "Failed to update product")
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, trusted: newValue } : p)))
      toast.success(`Product ${newValue ? "marked as trusted" : "unmarked as trusted"}`)
    } catch (err) {
      console.error("[Admin Products] ❌ Error toggling trusted:", err)
      toast.error(err instanceof Error ? err.message : "Failed to update product trusted status")
    }
  }

  // Open each product's edit page in a new tab/window and attempt to trigger an auto-save
  const openAllEditPagesAndTriggerSave = async () => {
    if (isAutoSaving) return
    if (!window.confirm('Open edit pages for ALL products and trigger save? This will open multiple tabs/windows.')) return
    setIsAutoSaving(true)
    try {
      const windows: Window[] = []
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
      for (const p of products) {
        try {
          const url = `/admin/products/${p.id}/edit?autoSave=1`
          const w = window.open(url, '_blank')
          if (w) windows.push(w)
        } catch (e) {
          console.warn('[Admin Products] ⚠️ Could not open window for', p.id, e)
        }
        // small delay to reduce popup blocking and avoid overwhelming the browser
         
        await sleep(250)
      }

      // Give pages a moment to load, then postMessage to request an auto-save
      await new Promise((r) => setTimeout(r, 1500))
      for (const w of windows) {
        try {
          // send a message the edit page can listen for: { type: 'AUTO_SAVE' }
          w.postMessage({ type: 'AUTO_SAVE' }, window.location.origin)
        } catch (e) {
          // ignore
        }
      }

      toast.success(`Opened ${windows.length} edit pages`)
    } catch (err) {
      console.error('[Admin Products] ❌ Error opening edit pages:', err)
      toast.error('Failed to open edit pages')
    } finally {
      setIsAutoSaving(false)
    }
  }

  const handleClearDatabase = async () => {
    console.log("[Admin Products] 🚨 Clear database requested")
    if (!window.confirm(
      "⚠️ WARNING: This will delete ALL products and categories from the database. This action cannot be undone. Are you absolutely sure?"
    )) {
      console.log("[Admin Products] ❌ Clear database cancelled (first confirmation)")
      return;
    }

    // Double confirmation
    if (!window.confirm(
      "This is your final warning. All data will be permanently deleted. Continue?"
    )) {
      console.log("[Admin Products] ❌ Clear database cancelled (second confirmation)")
      return;
    }

    try {
      console.log("[Admin Products] 📡 Sending POST request to /api/clear_database...")
      const response = await apiFetch("/api/clear_database", {
        method: "POST",
      });
      console.log("[Admin Products] 📥 Clear database response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Admin Products] ❌ Clear database failed:", errorData)
        throw new Error(errorData.details || errorData.error || "Failed to clear database");
      }

      const result = await response.json();
      console.log("[Admin Products] ✅ Database cleared:", result)
      alert(
        `Database cleared successfully! Deleted ${result.products?.deleted || 0} products and ${result.categories?.deleted || 0} categories.`
      );

      // Reset UI state
      console.log("[Admin Products] 🔄 Resetting UI state...")
      setProducts([]);
      setCategories([]);
      setSelectedCategory("all");
      await fetchCategories();

    } catch (err) {
      console.error("[Admin Products] ❌ Error clearing database:", err);
      alert(err instanceof Error ? err.message : "An unknown error occurred");
    }
  }

  const handleActivateAll = async () => {
    console.log("[Admin Products] 🔔 Activate All requested")
    if (!window.confirm("Are you sure you want to set ALL products to active? This will make all products visible to public users.")) {
      console.log("[Admin Products] ❌ Activate all cancelled by user")
      return
    }

    try {
      setActivatingAll(true)
      console.log("[Admin Products] 📡 Sending POST to /api/products/activate-all")
      const res = await apiFetch('/api/products/activate-all', { method: 'POST' })
      console.log('[Admin Products] 📥 Activate all response status:', res.status)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[Admin Products] ❌ Activate all failed:', data)
        throw new Error(data.error || data.message || 'Failed to activate all products')
      }

      toast.success('All products activated')
      // Refresh products list to reflect changes
      await fetchProducts()
      console.log('[Admin Products] ✅ Activate all completed')
    } catch (err) {
      console.error('[Admin Products] ❌ Error activating all products:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to activate all products')
    } finally {
      setActivatingAll(false)
    }
  }

  const handleSeedDatabase = async () => {
    console.log("[Admin Products] 🌱 Seed database requested")

    if (!window.confirm(
      "This will import products from JSON data. Any existing products with source='excel' will be replaced. Continue?"
    )) {
      console.log("[Admin Products] ❌ Seed database cancelled")
      return;
    }

    try {
      console.log("[Admin Products] 📡 Sending POST request to /api/seed-database...")
      const response = await apiFetch("/api/seed-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true }),
      });
      console.log("[Admin Products] 📥 Seed database response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Admin Products] ❌ Seed database failed:", errorData)
        throw new Error(errorData.error || errorData.message || "Failed to seed database");
      }

      const result = await response.json();
      console.log("[Admin Products] ✅ Database seeded:", result)
      alert(
        `Database seeded successfully!\n` +
        `Categories: ${result.categories?.insertedOrUpserted || 0}\n` +
        `Products: ${result.products?.inserted || 0}`
      );

      // Refresh data
      console.log("[Admin Products] 🔄 Refreshing products and categories...")
      await fetchCategories();
      await fetchProducts();

    } catch (err) {
      console.error("[Admin Products] ❌ Error seeding database:", err);
      alert(err instanceof Error ? err.message : "An unknown error occurred");
    }
  }

  const handleSort = (field: SortColumn) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Handle column resize
  const handleColumnResize = (columnKey: string, newWidth: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: Math.max(50, newWidth) // Minimum width of 50px
    }))
  }

  // Handle metadata update from Excel
  const handleMetadataUpdate = async (preview = true) => {
    if (!metadataUpdateFile) {
      toast.error("Please select an Excel file")
      return
    }

    try {
      setIsMetadataUpdating(true)
      const formData = new FormData()
      formData.append("file", metadataUpdateFile)
      formData.append("preview", preview.toString())

      const response = await apiFetch("/api/products/bulk-metadata-update", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to process file")
      }

      if (preview) {
        setMetadataPreviewData(result.preview || [])
        toast.success(`Preview: ${result.preview?.length || 0} products found`)
      } else {
        setMetadataUpdateResult({
          success: result.success || 0,
          failed: result.failed || 0,
          errors: result.errors || [],
        })
        toast.success(`Updated ${result.success} products`)
        fetchProducts() // Refresh the list
      }
    } catch (error) {
      console.error("Metadata update error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update metadata")
    } finally {
      setIsMetadataUpdating(false)
    }
  }

  const downloadMetadataTemplate = async () => {
    try {
      toast.loading("Fetching all products from database...", { id: "metadata-export" })

      // Fetch all products from the database
      const allProducts = await fetchAllAdminProducts(true)

      if (!allProducts || allProducts.length === 0) {
        toast.error("No products found in database", { id: "metadata-export" })
        return
      }

      const XLSX = await import("xlsx")

      /*
       * Built by iterating the field list rather than naming the keys, so the
       * sheet cannot drift from the contract the uploader reads it back with.
       * A row with no SKU has nothing to match on, so it is dropped.
       */
      const templateData = allProducts
        .map((product) => {
          const row = metadataSheetRowFromProduct(product)
          const sheetRow: Record<string, string> = {}
          for (const field of METADATA_SHEET_FIELDS) {
            sheetRow[METADATA_SHEET_COLUMNS[field]] = row[field]
          }
          return sheetRow
        })
        .filter((row) => row[METADATA_SHEET_COLUMNS.itemno].trim() !== "")

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(templateData)

      const COLUMN_WIDTHS: Record<MetadataSheetField, number> = {
        itemno: 20,
        name: 40,
        division: 22,
        category: 25,
        segment: 25,
        brand: 22,
      }
      ws['!cols'] = METADATA_SHEET_FIELDS.map((field) => ({ wch: COLUMN_WIDTHS[field] }))

      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Product Metadata")

      // Download file
      XLSX.writeFile(wb, "product-metadata-export.xlsx")
      toast.success(`Exported ${templateData.length} products successfully!`, { id: "metadata-export" })
    } catch (error) {
      console.error("Metadata export error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to export product metadata", { id: "metadata-export" })
    }
  }

  const downloadPriceTemplate = async () => {
    if (isPriceExporting) return
    setIsPriceExporting(true)
    try {
      const rows = buildActiveProductPriceSheet(await fetchAllAdminProducts())
      const XLSX = await import("xlsx")
      const book = XLSX.utils.book_new()
      const sheet = XLSX.utils.json_to_sheet(rows)
      sheet["!cols"] = [22, 16, 16].map(wch => ({ wch }))
      XLSX.utils.book_append_sheet(book, sheet, "Active Products")
      XLSX.writeFile(book, "active-products-price-mrp.xlsx")
      toast.success(`Downloaded ${rows.length} customer-visible products`)
    } catch (cause) {
      console.error("[Price Import] Template failed", cause)
      toast.error(cause instanceof Error ? cause.message : "Could not download active products")
    } finally {
      setIsPriceExporting(false)
    }
  }

  const handlePriceUpdate = async (preview = true) => {
    if (isPreviewLoading) return
    console.log("[Admin Products] 💰 Price update requested, preview:", preview)
    if (!priceUpdateFile) {
      alert("Please select a file first")
      return
    }
    try {
      setIsPreviewLoading(true)
      console.log("[Admin Products] 📄 File selected:", priceUpdateFile.name, "Size:", priceUpdateFile.size, "bytes")
      const formData = new FormData()
      formData.append("file", priceUpdateFile)
      if (preview) formData.append("preview", "true")

      console.log("[Admin Products] 📡 Sending POST request to /api/products/bulk-price-update...")
      const response = await apiFetch("/api/products/bulk-price-update", {
        method: "POST",
        body: formData,
      })
      console.log("[Admin Products] 📥 Price update response status:", response.status)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update prices")
      }

      if (preview) {
        setGoogleSheetId("")
        setPreviewData(result.updates)
        setPricePreviewPage(1)
        setIsPreviewLoading(false)
        setShowPriceUpdateModal(false)
        setShowPreviewModal(true)
      } else {
        console.log("[Admin Products] ✅ Price update successful")
        setPriceUpdateResult(result)
        setPreviewData(null) // Clear preview
        setShowPreviewModal(false)
        setShowPriceUpdateModal(true) // Show result in main modal? Or just alert. Let's keep it simple.
        await fetchProducts()
        alert(`Price/MRP update completed!\nSuccess: ${result.success}\nFailed: ${result.failed}\nDuplicate item numbers ignored (last row used): ${result.ignoredDuplicates || 0}\n${(result.errors || []).slice(0, 10).join("\n")}`)
      }

    } catch (error) {
      console.error("[Admin Products] ❌ Error updating prices:", error)
      alert(error instanceof Error ? error.message : "Failed to update prices")
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Bulk update MRP via Excel upload
  // (Bulk MRP upload handled via ExcelUpload component)

  const handleGoogleSheetSync = async (preview = true) => {
    if (isPreviewLoading || isSyncingGoogle) return
    console.log("[Admin Products] 📊 Google Sheet Sync requested, preview:", preview)
    if (!googleSheetId) {
      alert("Please paste a Google Sheet link or ID")
      return
    }

    try {
      if (preview) setIsPreviewLoading(true)
      else setIsSyncingGoogle(true)

      setPriceUpdateResult(null)

      console.log("[Admin Products] 📡 Sending POST to /api/products/google-sheet-price-sync")
      const response = await apiFetch("/api/products/google-sheet-price-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId: googleSheetId, preview }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to sync with Google Sheet")
      }

      if (preview) {
        setPriceUpdateFile(null)
        setPreviewData(result.updates)
        setPricePreviewPage(1)
        setIsPreviewLoading(false)
        setShowPriceUpdateModal(false)
        setShowPreviewModal(true)
      } else {
        setPriceUpdateResult(result)
        setPreviewData(null)
        setShowPreviewModal(false)
        setShowPriceUpdateModal(true)
        await fetchProducts()
        alert(`Sync completed!\nSuccess: ${result.success}\nFailed: ${result.failed}\nDuplicate item numbers ignored (last row used): ${result.ignoredDuplicates || 0}\n${(result.errors || []).slice(0, 10).join("\n")}`)
      }

    } catch (error) {
      console.error("[Admin Products] ❌ Error syncing:", error)
      alert(error instanceof Error ? error.message : "Failed to sync")
      setIsPreviewLoading(false)
    } finally {
      setIsSyncingGoogle(false)
    }
  }

  const handleExport = async () => {
    console.log("[Admin Products] 📤 Export requested")
    try {
      console.log("[Admin Products] 📡 Fetching /api/products/export...")
      const res = await apiFetch("/api/products/export")
      console.log("[Admin Products] 📥 Export response status:", res.status)

      if (!res.ok) {
        console.error("[Admin Products] ❌ Export failed with status:", res.status)
        throw new Error("Failed to export products")
      }

      console.log("[Admin Products] 📦 Creating blob from response...")
      const blob = await res.blob()
      console.log("[Admin Products] 📦 Blob size:", blob.size, "bytes")

      const url = URL.createObjectURL(blob)
      const filename = `products-export-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.xlsx`
      console.log("[Admin Products] 💾 Downloading file:", filename)

      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log("[Admin Products] ✅ Export completed successfully")
    } catch (error) {
      console.error("[Admin Products] ❌ Export error:", error)
      alert("Failed to export products")
    }
  }

  const filteredProducts = products.filter((product) => {
    const term = searchTerm.trim().toLowerCase()

    // 1. Search Filter
    const matchesSearch = !term || (
      (product.name || "").toString().toLowerCase().includes(term) ||
      (normalizeProductForSchema(product).itemno || "").toString().toLowerCase().includes(term) ||
      (product.ean || "").toString().toLowerCase().includes(term) ||
      (product.raw?.["EAN Number"] || "").toString().toLowerCase().includes(term)
    )

    const categoryName = getNormalizedCategoryName(product).toString().toLowerCase()
    const matchesCategory = selectedCategory === "all" || categoryName === selectedCategory.toLowerCase()

    // 2. Sub-Category Filter
    let matchesSub = true
    if (selectedSubCategory !== "all") {
      const prodSubValue = normalizeProductForSchema(product).subCategoryProdDesc
      const selectedSub = subCategories.find((s) => s.id === selectedSubCategory)
      const selectedSubName = selectedSub ? selectedSub.name : null
      matchesSub = selectedSubName ? prodSubValue.toString() === selectedSubName.toString() : false
    }

    // 3. Active Status Filter
    let matchesActive = true
    if (filterActiveStatus === "active") {
      matchesActive = product.active === true
    } else if (filterActiveStatus === "inactive") {
      matchesActive = !product.active
    }

    // 4. Merchandising hierarchy and brand, compared case-insensitively
    //    because the values come from hand-typed spreadsheets.
    const matchesLabel = (selected: string, value: string) =>
      selected === "all" || value.trim().toLowerCase() === selected.trim().toLowerCase()

    const matchesDivision = matchesLabel(selectedDivision, product.division || "")
    const matchesSegment = matchesLabel(selectedSegment, product.segment || "")
    const matchesBrand = matchesLabel(selectedBrand, product.brand || "")

    // 5. Stock
    const stock = Number(product.stock ?? 0)
    const matchesStock =
      stockFilter === "all" || (stockFilter === "in" ? stock > 0 : stock <= 0)

    return (
      matchesSearch &&
      matchesCategory &&
      matchesSub &&
      matchesActive &&
      matchesDivision &&
      matchesSegment &&
      matchesBrand &&
      matchesStock
    )
  })

  /*
   * Sorting reads through COLUMN_VALUES rather than indexing the document, so
   * a column shown as derived text — category, which falls back through three
   * stored fields — sorts by what the operator can actually see.
   */
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const read = COLUMN_VALUES[sortField]
    const va = read(a)
    const vb = read(b)
    const direction = sortDirection === "asc" ? 1 : -1

    if (typeof va === "number" && typeof vb === "number") return (va - vb) * direction

    // Blanks sort last in both directions: an unclassified product is never
    // the answer to "show me the first category alphabetically".
    const sa = String(va)
    const sb = String(vb)
    if (!sa && !sb) return 0
    if (!sa) return 1
    if (!sb) return -1
    return sa.localeCompare(sb) * direction
  })

  const divisionOptions = distinctValues(products, COLUMN_VALUES.division)
  const segmentOptions = distinctValues(products, COLUMN_VALUES.segment)
  const brandOptions = distinctValues(products, COLUMN_VALUES.brand)
  const selectedDivisionProducts = selectedDivision === "all"
    ? []
    : products.filter(product =>
      (product.division || "").trim().toLowerCase() === selectedDivision.trim().toLowerCase()
    )
  const selectedDivisionIsActive = selectedDivisionProducts.some(product => product.active === true)

  const totalRows = sortedProducts.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows)
  const paginatedProducts = sortedProducts.slice(startIndex, endIndex)

  // Reset to first page when filters/sorting change
  useEffect(() => {
    setCurrentPage(1)
  }, [
    searchTerm,
    sortField,
    sortDirection,
    selectedCategory,
    selectedSubCategory,
    selectedDivision,
    selectedSegment,
    selectedBrand,
    filterActiveStatus,
    stockFilter,
    products.length,
  ])

  const selectedCategoryName = categories.find((cat) => cat.id === selectedCategory)?.name || "All Categories"

  if (authLoading) return null

  if (!user || !canAccessAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Products Management</h1>
          <div className="flex items-center mt-2">
            <div
              className={`w-3 h-3 rounded-full mr-2 ${connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "failed"
                  ? "bg-red-500"
                  : "bg-yellow-500"
                }`}
            ></div>
            <span className="text-sm text-gray-600">
              MongoDB:{" "}
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "failed"
                  ? "Disconnected"
                  : "Checking..."}
            </span>
            {selectedCategory !== "all" && (
              <span className="ml-4 text-sm text-blue-600 font-medium">Category: {selectedCategoryName}</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 w-full">
          {/* <div className="w-full">
            <Link href="/admin/products/new" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center w-40 min-w-[8rem]">
              <Plus className="h-4 w-4 mr-2" />
              Add New Product
            </Link>
          </div> */}



          <div className="w-full">
            <button
              onClick={() => setShowPriceUpdateModal(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center min-w-[8rem]"
              title="Bulk update prices from Excel"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Update Prices
            </button>
          </div>

          <div className="w-full">
            <button
              onClick={() => setShowMetadataUpdateModal(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center min-w-[8rem]"
              title="Bulk update metadata from Excel"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Update Metadata
            </button>
          </div>

          {/* <div className="w-full">
            <button
              onClick={handleClearDatabase}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center w-40 min-w-[8rem]"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Database
            </button>
          </div> */}

          {/* <div className="w-full">
            <ExcelUpload onUploadComplete={fetchProducts} />
          </div> */}

          <div className="w-full">
            <button
              onClick={handleExport}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center justify-center min-w-[8rem]"
              title="Export products and per-store stock to Excel"
            >
              Export
            </button>
          </div>
          {/* 
          <div className="w-full">
            <button
              onClick={openAllEditPagesAndTriggerSave}
              disabled={isAutoSaving}
              className={`${isAutoSaving ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} w-full text-white px-4 py-2 rounded-lg flex items-center justify-center w-40 min-w-[8rem]`}
              title="Open each product edit page and trigger save"
            >
              {isAutoSaving ? 'Opening...' : 'Open Edit Pages & Save'}
            </button>
          </div> */}

          <div className="w-full">
            <button
              onClick={handleActivateAll}
              disabled={activatingAll}
              className={`${activatingAll ? 'bg-amber-300 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'} w-full text-white px-4 py-2 rounded-lg flex items-center justify-center min-w-[8rem]`}
              title="Set all products active"
            >
              {activatingAll ? 'Activating...' : 'Activate All'}
            </button>
          </div>

          <div className="w-full bg-gray-100">
            <ExcelUpload
              uploadUrl="/api/products/bulk-update-mrp"
              title="Bulk Update MRP"
              description="Upload an Excel file (.xlsx) with SKU and MRP columns. The uploader will update MRP for matching SKUs in the database."
              requiredColumns={["SKU", "MRP"]}
              triggerLabel="Bulk Update MRP"
              onUploadComplete={fetchProducts}
            />
          </div>
        </div>
      </div>

      {connectionStatus === "failed" && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-semibold">MongoDB Connection Failed</p>
              <p className="text-sm mt-1">{error}</p>
              <p className="text-sm mt-2">
                Please check:
                <br />• MongoDB URI is correct in .env.local
                <br />• MongoDB cluster is running and accessible
                <br />• Network connection is stable
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
          <strong>Warning:</strong> You need to open the product and verify it Onces a new product is added.
        </div>
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <div className="relative w-full sm:w-52 md:w-64">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md pl-10 text-sm"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>

            {/*
              Division / Segment / Brand only appear once some product carries
              the label. On an unclassified catalogue they would be dropdowns
              with a single "All" entry, which is just noise in the toolbar.
            */}
            {divisionOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={selectedDivision}
                    onChange={(e) => setSelectedDivision(e.target.value)}
                    className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-7 text-xs w-[140px] sm:max-w-[140px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Filter by division"
                  >
                    <option value="all">All Divisions</option>
                    {divisionOptions.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                  <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {selectedDivision !== "all" && (
                  <button
                    type="button"
                    disabled={updatingDivision || selectedDivisionProducts.length === 0}
                    onClick={() => handleToggleDivision(selectedDivision, !selectedDivisionIsActive)}
                    className={`rounded-md px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                      selectedDivisionIsActive
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                    title={`${selectedDivisionIsActive ? "Deactivate" : "Activate"} every product in ${selectedDivision}`}
                  >
                    {updatingDivision
                      ? "Updating..."
                      : `${selectedDivisionIsActive ? "Deactivate" : "Activate"} Division`}
                  </button>
                )}
              </div>
            )}

            {/* Category Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-7 text-xs w-[140px] sm:max-w-[140px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isCategoriesLoading}
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            {/* Sub Category Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-7 text-xs w-[140px] sm:max-w-[140px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Sub Categories</option>
                {subCategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {segmentOptions.length > 0 && (
              <div className="relative">
                <select
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-7 text-xs w-[140px] sm:max-w-[140px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Filter by segment"
                >
                  <option value="all">All Segments</option>
                  {segmentOptions.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
                <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {brandOptions.length > 0 && (
              <div className="relative">
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-7 text-xs w-[140px] sm:max-w-[140px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Filter by brand"
                >
                  <option value="all">All Brands</option>
                  {brandOptions.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
                <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Stock Filter Dropdown */}
            <div className="relative">
              <select
                value={stockFilter}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === "all" || value === "in" || value === "out") setStockFilter(value)
                }}
                className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-7 text-xs w-[120px] sm:max-w-[120px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Filter by stock"
              >
                <option value="all">All Stock</option>
                <option value="in">In Stock</option>
                <option value="out">Out of Stock</option>
              </select>
              <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Active Status Filter Dropdown */}
            <div className="relative">
              <select
                value={filterActiveStatus}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === "all" || value === "active" || value === "inactive") setFilterActiveStatus(value)
                }}
                className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-7 text-xs w-[120px] sm:max-w-[120px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="text-center lg:text-right">
            <div className="text-xs sm:text-sm text-gray-500">
              <div>{activeProductsCount} {activeProductsCount === 1 ? "active product" : "active products"} in MongoDB</div>
              <div className="text-gray-400">{filteredProducts.length} shown (after filters)</div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-4 text-gray-600">Loading products from MongoDB...</p>
          </div>
        ) : connectionStatus === "failed" ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Cannot connect to MongoDB</p>
              <p className="text-gray-500 mb-4">Unable to load products from the database.</p>
              <button
                onClick={checkDatabaseConnection}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {TABLE_COLUMNS.map(({ field, label, align }) => (
                    <SortableHeader
                      key={field}
                      label={label}
                      align={align}
                      active={sortField === field}
                      direction={sortDirection}
                      onSort={() => handleSort(field)}
                    />
                  ))}
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length + 1} className="px-6 py-4 text-center text-sm text-gray-500">
                      <div className="py-8">
                        <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-900 mb-2">
                          {selectedCategory === "all"
                            ? "No products found in MongoDB"
                            : `No products found in category "${selectedCategoryName}"`}
                        </p>
                        <p className="text-gray-500 mb-4">Start by adding products or importing sample data.</p>
                        <div className="space-x-2">
                          <Link href="/admin/products/new" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            Add Product
                          </Link>
                          <button
                            onClick={handleSeedDatabase}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                          >
                            Import JSON Data
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                      <tr key={product.id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <img
                              className="h-10 w-10 shrink-0 rounded object-cover"
                              src={product.image || "/placeholder.svg?height=40&width=40"}
                              alt={product.name}
                              onError={(e) => {
                                ; (e.target as HTMLImageElement).src = "/placeholder.svg?height=40&width=40"
                              }}
                            />
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-medium text-gray-900" title={product.name}>
                                {product.name}
                              </p>
                              <p className="mt-0.5 font-mono text-xs text-gray-500">
                                {normalizeProductForSchema(product).itemno || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <TaxonomyCell value={product.division} />
                        <TaxonomyCell value={COLUMN_VALUES.category(product)} />
                        <TaxonomyCell value={product.segment} />
                        <TaxonomyCell value={product.brand} />

                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-semibold text-gray-900">₹{product.price}</p>
                        </td>

                        <td className="px-4 py-3 text-right">
                          {product.mrp !== undefined && product.mrp !== null && Number(product.mrp) > 0 ? (
                            <p
                              className={`text-sm ${
                                Number(product.mrp) > Number(product.price)
                                  ? "text-gray-500 line-through"
                                  : "text-gray-900"
                              }`}
                            >
                              ₹{product.mrp}
                            </p>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {/* Out of stock is the thing worth spotting in a scan. */}
                          <span
                            className={`text-sm font-medium ${
                              Number(product.stock ?? 0) > 0 ? "text-gray-900" : "text-red-600"
                            }`}
                          >
                            {Number(product.stock ?? 0)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={Boolean(product.active ?? true)}
                                onChange={() => handleToggleActive(product.id, !(product.active ?? true))}
                                disabled={updatingActiveIds.includes(product.id)}
                                className="h-4 w-4 rounded border-gray-300 text-green-600"
                              />
                              {updatingActiveIds.includes(product.id) ? "Saving…" : "Active"}
                            </label>
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={Boolean(product.trusted ?? false)}
                                onChange={() => handleToggleTrusted(product.id, !(product.trusted ?? false))}
                                className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                              />
                              Trusted
                              {product.trusted && <Shield className="h-3 w-3 text-yellow-600" />}
                            </label>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/product/${product.slug || product.id}`} className="inline-block rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50" title="View on storefront">
                              <Eye className="h-4 w-4" />
                            </Link>
                            <Link href={`/admin/products/${product.id}/edit`} className="inline-block rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" title="Edit product">
                              <Edit className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                              title="Delete product"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sortedProducts.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4">
          <div className="text-sm text-gray-600">
            Showing {totalRows === 0 ? 0 : startIndex + 1}-{endIndex} of {totalRows}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-2 rounded-md text-sm ${currentPage === 1 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white"
                }`}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className={`px-3 py-2 rounded-md text-sm ${currentPage === totalPages ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white"
                }`}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Price Update Modal */}
      {/* Price Update Modal */}
      {showPriceUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Bulk Price Update</h3>
              <button onClick={() => setShowPriceUpdateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {/* Vertical Divider for large screens */}
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 transform -translate-x-1/2"></div>

              {/* Option 1: Excel Upload */}
              <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Upload className="h-5 w-5 text-blue-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-800">Option 1: Excel Upload</h4>
                </div>

                <p className="text-sm text-gray-600 mb-4 h-10">
                  Match existing item numbers and update price and MRP. Supports up to 50,000 rows (10 MB).
                </p>

                <div className="bg-white border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800 shadow-sm">
                  <p className="font-semibold mb-1">Required Format:</p>
                  <div className="space-y-1 opacity-80">
                    <p>• Col 1: <strong>itemno</strong> (SKU)</p>
                    <p>• Col 2: <strong>price</strong> (New Price)</p>
                    <p>• Col 3: <strong>mrp</strong> (optional; blank keeps current MRP)</p>
                    <p>Price must not exceed the new/current MRP.</p>
                    <p>Stock quantities come from <Link href="/admin/stock-check" className="font-semibold underline">Stock Check</Link>.</p>
                    <p>Unknown item numbers are reported; no new products are created. Duplicate item numbers use the last row.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button type="button" onClick={downloadPriceTemplate} disabled={isPriceExporting || isPreviewLoading || isSyncingGoogle} className="text-sm font-semibold text-blue-700 underline disabled:opacity-50">
                    {isPriceExporting ? "Downloading..." : "Download active products Excel"}
                  </button>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      setPriceUpdateFile(e.target.files?.[0] || null)
                      setPreviewData(null)
                    }}
                    className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-100 file:text-blue-700
                        hover:file:bg-blue-200
                        cursor-pointer mb-2"
                  />

                  <button
                    onClick={() => handlePriceUpdate(true)}
                    disabled={!priceUpdateFile || isPreviewLoading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                  >
                    {isPreviewLoading && priceUpdateFile ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    ) : null}
                    Preview from Excel
                  </button>
                </div>
                {priceUpdateFile && <p className="text-xs text-green-600 mt-2 font-medium">✓ File selected: {priceUpdateFile.name}</p>}
              </div>

              {/* Option 2: Google Sheet */}
              <div className="bg-green-50/50 p-5 rounded-xl border border-green-100 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Database className="h-5 w-5 text-green-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-800">Option 2: Google Sheet</h4>
                </div>

                <p className="text-sm text-gray-600 mb-4 h-10">
                  Fetch itemno, price and mrp directly from your Google Sheet link.
                </p>

                <div className="bg-white border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-800 shadow-sm">
                  <p className="font-semibold mb-1">Instructions:</p>
                  <div className="space-y-1 opacity-80">
                    <p>• File {'>'} Share {'>'} Publish to web</p>
                    <p>• Paste Sheet ID or Published Link</p>
                    <p>• Use only <strong>itemno</strong>, <strong>price</strong>, <strong>mrp</strong> as column headers.</p>
                    <p>• A shared link also works with “Anyone with the link can view”. The tab in your link is used.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={googleSheetId}
                    onChange={(e) => {
                      setGoogleSheetId(e.target.value)
                      setPreviewData(null)
                    }}
                    placeholder="Paste Sheet ID or URL..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all shadow-sm"
                  />
                  <button
                    onClick={() => handleGoogleSheetSync(true)}
                    disabled={!googleSheetId || isPreviewLoading}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                  >
                    {isPreviewLoading && googleSheetId ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    ) : null}
                    Preview from Sheet
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Alert */}
          {/* {
            priceUpdateResult && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-gray-900">Last Update Results:</p>
                    {priceUpdateResult.errors.length === 0 ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">Successful</span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">Has Errors</span>
                    )}
                  </div>

                  <div className="flex gap-6 text-sm">
                    <p className="text-green-600 font-medium">✓ Success: {priceUpdateResult.success}</p>
                    <p className="text-red-500 font-medium">✗ Failed: {priceUpdateResult.failed}</p>
                  </div>

                  {priceUpdateResult.errors.length > 0 && (
                    <div className="w-full mt-2 bg-white p-3 rounded-lg border border-gray-200 max-h-32 overflow-y-auto custom-scrollbar text-left">
                      <p className="text-xs font-semibold text-gray-500 mb-1 sticky top-0 bg-white">Error Details:</p>
                      <ul className="text-xs text-red-600 space-y-1 ml-4 list-disc">
                        {priceUpdateResult.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )} */}

          {/* <div className="mt-6 flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={() => {
                setShowPriceUpdateModal(false)
                setPriceUpdateResult(null)
                setPreviewData(null)
              }}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div> */}
        </div>
      )}

      {/* Separate Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Preview Bulk Product Changes</h3>
              <button onClick={() => {
                setShowPreviewModal(false)
                setShowPriceUpdateModal(true) // Go back
              }} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="overflow-auto border rounded-lg flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Item No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Name</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">MRP (old → new)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Old Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">New Price</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.slice((pricePreviewPage - 1) * 100, pricePreviewPage * 100).map((item, idx) => (
                      <tr key={idx} className={item.status === 'error' ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.sku}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]" title={item.name}>{item.name}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">{item.mrp ?? '-'} → {item.newMrp ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">{item.oldPrice !== null ? `₹${item.oldPrice}` : '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                          ₹{item.newPrice}
                          {item.oldPrice !== null && item.oldPrice > 0 && (
                            <span className={`ml-1 text-xs ${item.newPrice > item.oldPrice ? 'text-green-600' : 'text-red-600'}`}>
                              ({((item.newPrice - item.oldPrice) / item.oldPrice * 100).toFixed(1)}%)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {item.status === 'error' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={item.error}>
                              {item.error === 'Price > MRP' ? 'Invalid (> MRP)' : 'Invalid'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center border-t pt-4">
              <div className="text-sm text-gray-500">
                Total Items: {previewData.length} |
                Valid: {previewData.filter((i) => i.status === 'valid').length} |
                Errors: {previewData.filter((i) => i.status === 'error').length}
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" disabled={pricePreviewPage <= 1} onClick={() => setPricePreviewPage(page => page - 1)} className="rounded border px-2 py-1 disabled:opacity-50">Previous</button>
                  <span>Page {pricePreviewPage} of {Math.max(1, Math.ceil(previewData.length / 100))}</span>
                  <button type="button" disabled={pricePreviewPage * 100 >= previewData.length} onClick={() => setPricePreviewPage(page => page + 1)} className="rounded border px-2 py-1 disabled:opacity-50">Next</button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPreviewModal(false)
                    setShowPriceUpdateModal(true)
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                >
                  Back to Selection
                </button>
                <button
                  onClick={() => {
                    // Confirm action
                    if (priceUpdateFile) handlePriceUpdate(false)
                    else if (googleSheetId) handleGoogleSheetSync(false)
                  }}
                  disabled={isSyncingGoogle || isPreviewLoading || !previewData.some(item => item.status === 'valid')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSyncingGoogle || isPreviewLoading ? 'Processing Updates...' : 'Confirm & Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Update Modal */}
      {showMetadataUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Bulk Metadata Update</h3>
              <button
                onClick={() => {
                  setShowMetadataUpdateModal(false)
                  setMetadataUpdateFile(null)
                  setMetadataPreviewData(null)
                  setMetadataUpdateResult(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="bg-green-50/50 p-5 rounded-xl border border-green-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-100 p-2 rounded-lg">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800">Upload Excel File</h4>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Upload an Excel file (.xlsx) containing updated metadata for products.
              </p>

              <div className="bg-white border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-800 shadow-sm">
                <p className="font-semibold mb-1">Required Format (Column Headers):</p>
                <div className="grid grid-cols-2 gap-1 opacity-80">
                  {METADATA_SHEET_FIELDS.map((field) => (
                    <p key={field}>• <strong>{METADATA_SHEET_COLUMNS[field]}</strong> - {METADATA_SHEET_DESCRIPTIONS[field]}</p>
                  ))}
                </div>
              </div>

              <button
                onClick={downloadMetadataTemplate}
                className="w-full mb-3 py-2 bg-white hover:bg-gray-50 text-green-700 border border-green-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download Template Excel
              </button>

              <div className="space-y-3">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    setMetadataUpdateFile(e.target.files?.[0] || null)
                    setMetadataPreviewData(null)
                    setMetadataUpdateResult(null)
                  }}
                  className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-green-100 file:text-green-700
                      hover:file:bg-green-200
                      cursor-pointer mb-2"
                />

                <button
                  onClick={() => handleMetadataUpdate(true)}
                  disabled={!metadataUpdateFile || isMetadataUpdating}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                >
                  {isMetadataUpdating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : null}
                  Preview Changes
                </button>
              </div>
              {metadataUpdateFile && <p className="text-xs text-green-600 mt-2 font-medium">✓ File selected: {metadataUpdateFile.name}</p>}
            </div>

            {/* Preview Table */}
            {metadataPreviewData && metadataPreviewData.length > 0 && (
              <div className="mt-4 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-y-auto border rounded-lg flex-1 max-h-[300px]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        {METADATA_PREVIEW_COLUMNS.map(({ field, label }) => (
                          <th key={field} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
                            {label}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase bg-gray-50">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metadataPreviewData.map((item, idx) => (
                        <tr key={idx} className={item.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          {METADATA_PREVIEW_COLUMNS.map(({ field }) => (
                            <td
                              key={field}
                              className="px-3 py-2 text-sm text-gray-600 truncate max-w-[150px]"
                              title={item[field]}
                            >
                              {item[field] || '-'}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-sm text-center">
                            {item.status === 'error' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={item.error}>
                                {item.error || 'Error'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Found
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    Total: {metadataPreviewData.length} |
                    Found: {metadataPreviewData.filter((i) => i.status !== 'error').length} |
                    Errors: {metadataPreviewData.filter((i) => i.status === 'error').length}
                  </div>
                  <button
                    onClick={() => handleMetadataUpdate(false)}
                    disabled={isMetadataUpdating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isMetadataUpdating ? 'Updating...' : 'Confirm & Update'}
                  </button>
                </div>
              </div>
            )}

            {/* Results */}
            {metadataUpdateResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-gray-900">Update Results:</p>
                  {metadataUpdateResult.errors?.length === 0 ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">Successful</span>
                  ) : (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">Has Errors</span>
                  )}
                </div>
                <div className="flex gap-6 text-sm mt-2">
                  <p className="text-green-600 font-medium">✓ Updated: {metadataUpdateResult.success}</p>
                  <p className="text-red-500 font-medium">✗ Failed: {metadataUpdateResult.failed}</p>
                </div>
                {metadataUpdateResult.errors?.length > 0 && (
                  <div className="mt-2 bg-white p-3 rounded-lg border border-gray-200 max-h-24 overflow-y-auto text-xs text-red-600">
                    {metadataUpdateResult.errors.map((err: string, idx: number) => (
                      <p key={idx}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
