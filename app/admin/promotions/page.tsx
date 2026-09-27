"use client"

import { apiFetch } from "@/lib/api-client"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

type Scope = "all" | "products" | "skus" | "brands"
type Type = "fixed" | "percentage" | "buy_get"

interface CouponForm {
  code: string
  name: string
  type: Type
  value: number
  maxDiscount?: number
  applyScope: Scope
  productIds?: string
  skus?: string
  brands?: string
  startDate?: string
  endDate?: string
  noEndDate: boolean
  usageLimit?: number
  perCustomerLimit?: number
  buyQty?: number
  getQty?: number
  active: boolean
}

interface Product {
  id: string
  name: string
  price: number
  sku?: string
  manufacturerName?: string
  image?: string
}

export default function PromotionsAdminPage() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [form, setForm] = useState<CouponForm>({
    code: "",
    name: "",
    type: "fixed",
    value: 0,
    maxDiscount: undefined,
    applyScope: "all",
  productIds: "",
  skus: "",
    brands: "",
    startDate: "",
    endDate: "",
    noEndDate: false,
    usageLimit: undefined,
    perCustomerLimit: undefined,
    buyQty: undefined,
    getQty: undefined,
    active: true,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [usageFor, setUsageFor] = useState<{ code: string;
 id: string } | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageRows, setUsageRows] = useState<Array<{ id: string; total: number; createdAt?: string; status?: string }>>(
    [],
  )

  const load = async () => {
    const res = await apiFetch("/api/coupons")
    const data = await res.json()
    const coupons = data.coupons || []

    // Fetch usage counts for all coupon codes
    const codes = coupons.map((c: any) => c.code)
    const usageCounts = await fetchUsageCounts(codes)

    // Merge usage counts into coupons
    const couponsWithUsage = coupons.map((c: any) => ({
      ...c,
      usageCount: usageCounts[c.code] || 0,
    }))

    setList(couponsWithUsage)
  }

  useEffect(() => {
    load()
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setProductsLoading(true)
      const res = await apiFetch("/api/products")
      const data = await res.json()
      setProducts(data || [])
    } catch (e) {
      console.error("Failed to load products", e)
      toast.error("Failed to load products")
    } finally {
      setProductsLoading(false)
    }
  }

  // Update selected products when form.productIds changes
  useEffect(() => {
    if (form.productIds) {
      const ids = form.productIds.split(",").map(s => s.trim()).filter(Boolean)
      setSelectedProducts(ids)
    } else {
      setSelectedProducts([])
    }
  }, [form.productIds])

  const toggleProductSelection = (productId: string) => {
    const newSelected = selectedProducts.includes(productId)
      ? selectedProducts.filter(id => id !== productId)
      : [...selectedProducts, productId]
    
    setSelectedProducts(newSelected)
    setForm({ ...form, productIds: newSelected.join(",") })
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  )

  const submit = async () => {
    // Validation
    if (!form.code.trim()) {
      toast.error("Coupon code is required")
      return
    }
    if (!form.name.trim()) {
      toast.error("Coupon name is required")
      return
    }
    if (form.type !== "buy_get" && (!form.value || form.value <= 0)) {
      toast.error("Discount value must be greater than 0")
      return
    }
    if (form.type === "buy_get" && (!form.buyQty || !form.getQty)) {
      toast.error("Buy and Get quantities are required for Buy X Get Y offers")
      return
    }

    try {
      setLoading(true)
      const payload: any = {
        ...form,
        productIds:
          form.applyScope === "products" && form.productIds
            ? form.productIds
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        skus:
          form.applyScope === "skus" && form.skus
            ? form.skus
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        brands:
          form.applyScope === "brands" && form.brands
            ? form.brands
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
      }

      const url = editingId ? `/api/coupons/${editingId}` : "/api/coupons"
      const method = editingId ? "PUT" : "POST"

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) return toast.error(data.error || "Failed to save coupon")
      toast.success(editingId ? "Coupon updated successfully!" : "Coupon created successfully!")
      
      // Reset form
      setForm({
        code: "",
        name: "",
        type: "fixed",
        value: 0,
        maxDiscount: undefined,
        applyScope: "all",
        productIds: "",
        skus: "",
        brands: "",
        startDate: "",
        endDate: "",
        noEndDate: false,
        usageLimit: undefined,
        perCustomerLimit: undefined,
        buyQty: undefined,
        getQty: undefined,
        active: true,
      })
      setEditingId(null)
      await load()
    } catch (e) {
      console.error(e)
      toast.error("Error saving coupon")
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (c: any) => {
    setEditingId(c.id || c._id)
    setForm({
      code: c.code || "",
      name: c.name || "",
      type: (c.type as any) || "fixed",
      value: c.value || 0,
      maxDiscount: c.maxDiscount ?? undefined,
  applyScope: (c.applyScope as any) || "all",
  productIds: (c.productIds || []).join(","),
  skus: (c.skus || []).join(","),
      brands: (c.brands || []).join(","),
      startDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : "",
      endDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : "",
      noEndDate: !!c.noEndDate,
      usageLimit: c.usageLimit ?? undefined,
      perCustomerLimit: c.perCustomerLimit ?? undefined,
      buyQty: c.buyQty ?? undefined,
      getQty: c.getQty ?? undefined,
      active: !!c.active,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this coupon?")) return
    try {
      const res = await apiFetch(`/api/coupons/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!data.success) return toast.error(data.error || "Delete failed")
      toast.success("Deleted")
      await load()
    } catch (e) {
      console.error(e)
      toast.error("Error deleting coupon")
    }
  }

  const loadUsage = async (code: string, id: string) => {
    setUsageFor({ code, id })
    setUsageLoading(true)
    setUsageRows([])
    try {
      const res = await apiFetch(`/api/orders?couponCode=${encodeURIComponent(code)}`)
      const orders = await res.json()
      // Each order will have a .coupon property if a coupon was used
      orders.forEach((order: any) => {
        if (order.coupon && order.coupon.code === code) {
          // Coupon was used in this order
          // You can access order.coupon.name and order.coupon.discount as well
        }
      })
      const rows = (orders || []).map((o: any) => ({
        id: o.id,
        total: Number(o.total || 0),
        createdAt: o.createdAt || o.date,
        status: o.status || "pending",
        coupon: o.coupon || null, // <-- Add coupon info
      }))
      setUsageRows(rows)
    } catch (e) {
      console.error(e)
      toast.error("Failed to load usage")
    } finally {
      setUsageLoading(false)
    }
  }

  // Fetch usage count for all coupon codes
  const fetchUsageCounts = async (codes: string[]) => {
    try {
      const res = await apiFetch(`/api/orders?couponUsageCount=${codes.join(",")}`)
      const data = await res.json()
      // data should be an object: { [code]: count }
      return data.counts || {}
    } catch (e) {
      console.error("Failed to fetch usage counts", e)
      return {}
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Promotions & Coupons</h1>
        <p className="text-gray-600 mt-1">Create and manage discount coupons for your store</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Create/Edit form */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{editingId ? "Edit Coupon" : "Create Coupon"}</h2>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null)
                  setForm({
                    code: "",
                    name: "",
                    type: "fixed",
                    value: 0,
                    maxDiscount: undefined,
                    applyScope: "all",
                    productIds: "",
                    skus: "",
                    brands: "",
                    startDate: "",
                    endDate: "",
                    noEndDate: false,
                    usageLimit: undefined,
                    perCustomerLimit: undefined,
                    buyQty: undefined,
                    getQty: undefined,
                    active: true,
                  })
                }}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Coupon code</label>
              <input
                className="w-full border rounded px-2 py-2"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm">Coupon name</label>
              <input
                className="w-full border rounded px-2 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm">Type</label>
              <select
                className="w-full border rounded px-2 py-2"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Type })}
              >
                <option value="fixed">Rupees Discount (₹)</option>
                <option value="percentage">Percentage Discount (%)</option>
                <option value="buy_get">Buy X Get Y Free</option>
              </select>
            </div>
            {form.type !== "buy_get" ? (
              <div>
                <label className="text-sm">{form.type === "fixed" ? "Discount (₹)" : "Discount (%)"}</label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-2"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm">Buy Qty</label>
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-2"
                    value={form.buyQty || 0}
                    onChange={(e) => setForm({ ...form, buyQty: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm">Get Qty (free)</label>
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-2"
                    value={form.getQty || 0}
                    onChange={(e) => setForm({ ...form, getQty: Number(e.target.value) })}
                  />
                </div>
              </>
            )}
            {form.type === "percentage" && (
              <div>
                <label className="text-sm">Max Discount (₹, optional)</label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-2"
                  value={form.maxDiscount || 0}
                  onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                />
              </div>
            )}
            <div>
              <label className="text-sm">Apply to</label>
              <select
                className="w-full border rounded px-2 py-2"
                value={form.applyScope}
                onChange={(e) => setForm({ ...form, applyScope: e.target.value as Scope })}
              >
                <option value="all">All products</option>
                <option value="products">Specific products (IDs)</option>
              </select>
            </div>
            {form.applyScope === "products" && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Select Products</label>
                
                {/* Selected Products Display */}
                {selectedProducts.length > 0 && (
                  <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">
                        {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProducts([])
                          setForm({ ...form, productIds: "" })
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedProducts.map(id => {
                        const product = products.find(p => p.id === id)
                        return product ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded text-xs border border-blue-300"
                          >
                            {product.name}
                            <button
                              type="button"
                              onClick={() => toggleProductSelection(id)}
                              className="text-red-500 hover:text-red-700 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        ) : null
                      })}
                    </div>
                  </div>
                )}

                {/* Product Selector Button */}
                <button
                  type="button"
                  onClick={() => setShowProductSelector(!showProductSelector)}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-gray-600 hover:text-blue-600"
                >
                  {showProductSelector ? '− Hide Product List' : '+ Select Products'}
                </button>

                {/* Product Selector Panel */}
                {showProductSelector && (
                  <div className="mt-3 border rounded-lg overflow-hidden">
                    {/* Search */}
                    <div className="p-3 bg-gray-50 border-b">
                      <input
                        type="text"
                        placeholder="Search products by name or SKU..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                    </div>

                    {/* Products List */}
                    <div className="max-h-64 overflow-y-auto">
                      {productsLoading ? (
                        <div className="p-4 text-center text-gray-500 text-sm">Loading products...</div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">No products found</div>
                      ) : (
                        <div className="divide-y">
                          {filteredProducts.map(product => (
                            <label
                              key={product.id}
                              className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedProducts.includes(product.id)}
                                onChange={() => toggleProductSelection(product.id)}
                                className="w-4 h-4 text-blue-600 rounded"
                              />
                              {product.image && (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {product.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {product.sku && <span className="mr-2">SKU: {product.sku}</span>}
                                  <span className="font-semibold">₹{product.price.toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {form.applyScope === "skus" && (
              <div className="md:col-span-2">
                <label className="text-sm">SKUs (comma-separated)</label>
                <input
                  className="w-full border rounded px-2 py-2"
                  value={form.skus}
                  onChange={(e) => setForm({ ...form, skus: e.target.value })}
                />
              </div>
            )}
            {form.applyScope === "brands" && (
              <div className="md:col-span-2">
                <label className="text-sm">Brands (comma-separated)</label>
                <input
                  className="w-full border rounded px-2 py-2"
                  value={form.brands}
                  onChange={(e) => setForm({ ...form, brands: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="text-sm">Valid from</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-2"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm">Valid until</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-2"
                disabled={form.noEndDate}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
              <label className="flex items-center gap-2 mt-1 text-sm">
                <input
                  type="checkbox"
                  checked={form.noEndDate}
                  onChange={(e) => setForm({ ...form, noEndDate: e.target.checked })}
                />
                Don't set an end date
              </label>
            </div>
            <div>
              <label className="text-sm font-medium">Total usage limit</label>
              <input
                type="number"
                min="0"
                className="w-full border rounded px-2 py-2"
                value={form.usageLimit || 0}
                onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                placeholder="0 = unlimited"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum times this coupon can be used (0 = unlimited)</p>
            </div>
            <div>
              <label className="text-sm font-medium">Per-customer limit</label>
              <input
                type="number"
                min="0"
                className="w-full border rounded px-2 py-2"
                value={form.perCustomerLimit || 0}
                onChange={(e) => setForm({ ...form, perCustomerLimit: Number(e.target.value) })}
                placeholder="0 = unlimited"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum times per customer (0 = unlimited)</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm">Active</label>
              <label className="ml-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
              </label>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={submit}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
            </button>
          </div>
        </div>

        {/* Right: Coupons table and Usage */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-5 border-b">
              <h2 className="font-semibold">Coupons</h2>
            </div>
            <div className="p-5 overflow-x-auto">
              {list.length === 0 ? (
                <div className="text-sm text-gray-500">No coupons yet.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Scope</th>
                      <th className="py-2 pr-4">Usage</th>
                      <th className="py-2 pr-4">Active</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c: any) => (
                      <tr key={c.id || c._id} className="border-t">
                        <td className="py-2 pr-4 font-mono">{c.code}</td>
                        <td className="py-2 pr-4">{c.name}</td>
                        <td className="py-2 pr-4">
                          {c.type !== "buy_get" ? (
                            <>
                              {c.type} {c.type === "fixed" ? `₹${c.value}` : `${c.value}%`}
                              {c.maxDiscount ? ` (max ₹${c.maxDiscount})` : ""}
                            </>
                          ) : (
                            <>
                              Buy {c.buyQty} Get {c.getQty}
                            </>
                          )}
                        </td>
                        <td className="py-2 pr-4">{c.applyScope}</td>
                        <td className="py-2 pr-4">
                          <div className="text-sm">
                            <div className="font-medium">
                              {c.usageCount || 0}
                              {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                            </div>
                            {c.perCustomerLimit && (
                              <div className="text-xs text-gray-500">
                                Max {c.perCustomerLimit}/user
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`text-xs px-2 py-1 rounded ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                          >
                            {c.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-2 pr-0">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => startEdit(c)}
                              className="px-2 py-1 border rounded hover:bg-gray-50"
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => remove(c.id || c._id)}
                              className="px-2 py-1 border rounded hover:bg-gray-50"
                              title="Delete"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => loadUsage(c.code, c.id || c._id)}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              title="View Usage"
                            >
                              Usage
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Usage Panel */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold">{usageFor ? `Usage for ${usageFor.code}` : "Coupon Usage"}</h2>
              {usageFor && (
                <button
                  onClick={() => {
                    setUsageFor(null)
                    setUsageRows([])
                  }}
                  className="text-sm text-gray-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-5 overflow-x-auto">
              {!usageFor ? (
                <div className="text-sm text-gray-500">Select a coupon’s “Usage” to view orders.</div>
              ) : usageLoading ? (
                <div className="text-sm text-gray-600">Loading usage…</div>
              ) : usageRows.length === 0 ? (
                <div className="text-sm text-gray-500">No orders found using this code.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2 pr-4">Order ID</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Order Total (₹)</th>
                      {/* <th className="py-2 pr-4">Customer Email</th> */}
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-2 pr-4 font-mono">{r.id}</td>
                        <td className="py-2 pr-4">{r.status}</td>
                        <td className="py-2 pr-4 font-semibold">₹{Number(r.total || 0).toLocaleString("en-IN")}</td>
                        {/* <td className="py-2 pr-4">
                          {(r as any).customer?.email ? (
                            <span className="text-blue-600">{(r as any).customer.email}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td> */}
                        <td className="py-2 pr-4">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</td>
                        <td className="py-2 pr-4 text-right">
                          <a
                            href={`/admin/orders/${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2 py-1 border rounded hover:bg-gray-50"
                            title="View Order"
                          >
                            {/* Simple eye icon SVG */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
