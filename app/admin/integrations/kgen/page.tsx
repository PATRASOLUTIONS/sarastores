"use client"

import { apiFetch } from "@/lib/api-client"
import { IntegrationError } from "./integration-error"
import React, { useEffect, useMemo, useState } from "react"

const RotateCw = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)

const ChevronDown = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const ChevronUp = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
)

const ArrowRight = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

interface ProductRow {
  productID?: string
  name?: string
  category?: string
  variants?: any[]
  [k: string]: any
}

export default function KGenIntegrationPage() {
  const [items, setItems] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState<boolean | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [rowsPerPage, setRowsPerPage] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [totalOrders, setTotalOrders] = useState<number | null>(null)
  const [totalPayments, setTotalPayments] = useState<number | null>(null)
  const [totalProducts, setTotalProducts] = useState<number | null>(null)
  const [walletBalance, setWalletBalance] = useState<{ balance: number;
 currency?: string } | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null)
  const [totalOrdersOpen, setTotalOrdersOpen] = useState<number | null>(null)
  const [totalPaymentsPending, setTotalPaymentsPending] = useState<number | null>(null)
  const [salesData, setSalesData] = useState<Array<{ date: string; value: number }>>([])

  const fetchProducts = async (nextCursor?: string, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = nextCursor
        ? `/api/integrations/exlr8/products?cursor=${encodeURIComponent(nextCursor)}`
        : "/api/integrations/exlr8/products"
      const res = await apiFetch(url)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Status ${res.status}`)
      }
      const data = await res.json()

      let list: any[] = []
      if (Array.isArray(data)) list = data
      else if (Array.isArray(data.data)) list = data.data
      else if (Array.isArray(data.products)) list = data.products
      else if (Array.isArray(data.items)) list = data.items
      else list = [data]

      const pagination = data?.paginationInfo || data?.meta || null
      const next = pagination?.nextCursor || pagination?.next_cursor || null
      const more = typeof pagination?.hasMore !== "undefined" ? pagination.hasMore : (pagination?.has_more ?? null)

      setCursor(next)
      setHasMore(more)

      if (append) setItems((prev) => prev.concat(list))
      else setItems(list)
    } catch (err: any) {
      console.error("Failed to fetch exlr8 products", err)
      setError(err?.message || "Failed to fetch")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchSummary()
  }, [])

  const fetchSummary = async () => {
    try {
      try {
        const ex = await apiFetch("/api/integrations/exlr8/orders?limit=1")
        if (ex.ok) {
          const ed = await ex.json().catch(() => null)
          const upstreamTotal = ed?.total ?? ed?.totalCount ?? ed?.meta?.total ?? ed?.count ?? null
          if (typeof upstreamTotal === "number") setTotalOrders(Number(upstreamTotal))
          else if (Array.isArray(ed?.orders)) setTotalOrders(ed.orders.length)
          else setTotalOrders(null)

          const openCandidates = [
            ed?.openCount,
            ed?.pendingCount,
            ed?.counts?.OPEN,
            ed?.counts?.open,
            ed?.statusCounts?.OPEN,
            ed?.statusCounts?.open,
            ed?.data?.counts?.open,
          ]
          const openFound = openCandidates.find((v) => typeof v === "number")
          setTotalOrdersOpen(typeof openFound === "number" ? Number(openFound) : null)
        } else {
          setTotalOrders(null)
          setTotalOrdersOpen(null)
        }
      } catch (e) {
        console.warn("fetch exlr8 orders failed", e)
        setTotalOrders(null)
        setTotalOrdersOpen(null)
      }
    } catch (e) {
      console.warn("fetchSummary orders outer failed", e)
      setTotalOrders(null)
    }

    try {
      try {
        const ex = await apiFetch("/api/integrations/exlr8/wallet/transactions?limit=1")
        if (ex.ok) {
          const ed = await ex.json().catch(() => null)
          const paymentsCount =
            ed?.count ??
            ed?.total ??
            (Array.isArray(ed?.transactions) ? ed.transactions.length : null) ??
            ed?.meta?.total ??
            null
          const paymentsAmount = ed?.totalAmount ?? ed?.sum ?? ed?.total ?? ed?.meta?.sum ?? null
          setTotalPayments(
            typeof paymentsCount === "number"
              ? Number(paymentsCount)
              : Array.isArray(ed?.transactions)
                ? ed.transactions.length
                : null,
          )
          setTotalRevenue(typeof paymentsAmount === "number" ? Number(paymentsAmount) : null)

          const pendingCandidates = [
            ed?.pendingCount,
            ed?.processingCount,
            ed?.statusCounts?.PENDING,
            ed?.statusCounts?.pending,
            ed?.data?.counts?.pending,
          ]
          const pendingFound = pendingCandidates.find((v) => typeof v === "number")
          setTotalPaymentsPending(typeof pendingFound === "number" ? Number(pendingFound) : null)
        } else {
          setTotalPayments(null)
          setTotalRevenue(null)
          setTotalPaymentsPending(null)
        }
      } catch (e) {
        console.warn("fetch exlr8 transactions failed", e)
        setTotalPayments(null)
        setTotalRevenue(null)
        setTotalPaymentsPending(null)
      }
    } catch (e) {
      console.warn("fetchSummary transactions outer failed", e)
      setTotalPayments(null)
      setTotalRevenue(null)
    }

    try {
      const prod = await apiFetch("/api/integrations/exlr8/products?limit=1")
      if (prod.ok) {
        const d = await prod.json().catch(() => null)
        const pTotal =
          d?.total ?? d?.totalCount ?? d?.meta?.total ?? (Array.isArray(d?.products) ? d.products.length : null)
        if (typeof pTotal === "number") setTotalProducts(Number(pTotal))
        else setTotalProducts(null)
      }
    } catch (e) {
      setTotalProducts(null)
    }

    try {
      setWalletError(null)
      const wal = await apiFetch("/api/integrations/exlr8/wallet/balance")
      if (!wal.ok) {
        const text = await wal.text().catch(() => null)
        setWalletError(text || `Status ${wal.status}`)
        setWalletBalance(null)
      } else {
        const d = await wal.json().catch(() => null)
        if (d && typeof d.balance === "number") {
          setWalletBalance({ balance: Number(d.balance), currency: d.currency || "INR" })
        } else {
          setWalletBalance(null)
        }
      }
    } catch (e: any) {
      console.warn("Failed to fetch exlr8 wallet balance", e)
      setWalletError(String(e?.message || e))
      setWalletBalance(null)
    }

    try {
      const sales = await apiFetch("/api/admin/sales/daily")
      if (sales.ok) {
        const d = await sales.json()
        if (Array.isArray(d))
          setSalesData(d.map((r: any) => ({ date: String(r.date), value: Number(r.value || r.sales || r.total || 0) })))
      }
    } catch (e) {}
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [items, rowsPerPage, searchTerm])

  const getCellValue = (it: any, key: string) => {
    switch (key) {
      case "productID":
        return it.productID || it.productId || it.id || ""
      case "name":
        return it.productDisplayName || it.productName || it.name || ""
      case "category":
        if (Array.isArray(it.categories)) return it.categories.map((c: any) => c.categoryName || c.name).join(" | ")
        return it.category || it.categoryName || it.segment || ""
      case "variants":
        if (Array.isArray(it.variants)) return it.variants.length
        if (Array.isArray(it.items)) return it.items.length
        return it.variantCount || it.variants_count || 0
      case "face":
        return Number(it.faceValue || it.price || it.mrp || (it.variants && it.variants[0]?.price) || 0)
      case "status":
        return it.active === false ? "inactive" : it.status || it.availability || (it.active ? "active" : "")
      default:
        return it[key] ?? ""
    }
  }

  const filteredAndSorted = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    let list = items.slice()
    if (term) {
      list = list.filter((it: any) => {
        const vals = [getCellValue(it, "productID"), getCellValue(it, "name"), getCellValue(it, "category")]
        return vals.some((v: any) => String(v).toLowerCase().includes(term))
      })
    }

    if (sortKey) {
      list.sort((a: any, b: any) => {
        const va = getCellValue(a, sortKey)
        const vb = getCellValue(b, sortKey)
        const na = Number(va)
        const nb = Number(vb)
        if (!Number.isNaN(na) && !Number.isNaN(nb)) {
          return sortDir === "asc" ? na - nb : nb - na
        }
        const sa = String(va).toLowerCase()
        const sb = String(vb).toLowerCase()
        if (sa < sb) return sortDir === "asc" ? -1 : 1
        if (sa > sb) return sortDir === "asc" ? 1 : -1
        return 0
      })
    }

    return list
  }, [items, searchTerm, sortKey, sortDir])

  const StatCard = ({
    title,
    value,
    subtitle,
    href,
  }: { title: string; value: string | number | null; subtitle?: string; href?: string }) => (
    <div className="group relative bg-white border border-gray-200 hover:border-blue-500 rounded-lg p-5 flex flex-col transition-all duration-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">{title}</div>
          <div className="text-3xl font-bold mt-2 text-black">
            {value === null
              ? "—"
              : typeof value === "number"
                ? value >= 1000
                  ? value.toLocaleString("en-IN")
                  : value
                : value}
          </div>
          {subtitle && <div className="text-xs text-gray-500 mt-2">{subtitle}</div>}
        </div>
        {href && (
          <a
            href={href}
            className="ml-4 text-blue-600 hover:text-blue-700 transition-colors opacity-0 group-hover:opacity-100"
          >
            <ArrowRight className="h-5 w-5" />
          </a>
        )}
      </div>
    </div>
  )

  const SalesSparkline = ({ data }: { data: Array<{ date: string; value: number }> }) => {
    if (!data || data.length === 0) return <div className="text-sm text-gray-500">No sales data</div>
    const values = data.map((d) => d.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const w = 240
    const h = 48
    const step = w / Math.max(1, values.length - 1)
    const points = values
      .map((v, i) => {
        const x = i * step
        const y = h - ((v - min) / (max - min || 1)) * h
        return `${x},${y}`
      })
      .join(" ")
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  const totalRows = filteredAndSorted.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const pageItems = filteredAndSorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const walletDisplay = walletBalance
    ? `₹${Number(walletBalance.balance).toLocaleString("en-IN")} ${walletBalance.currency || ""}`
    : null
  const walletSubtitle = walletBalance ? "Available balance" : walletError ? `Error: ${walletError}` : undefined

  const DetailsButton = ({ rowId, item }: { rowId: string; item: any }) => {
    const isOpen = expandedId === rowId
    return (
      <button
        onClick={() => setExpandedId(isOpen ? null : rowId)}
        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs flex items-center gap-1 transition-colors text-black"
        aria-expanded={isOpen}
      >
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Details
      </button>
    )
  }

  const DetailsRow = ({ item, rowId }: { item: any; rowId: string }) => {
    if (expandedId !== rowId) return <div style={{ display: "none" }} />

    const attachments: string[] = Array.isArray(item.attachments)
      ? item.attachments
      : Array.isArray(item.images)
        ? item.images.map((i: any) => i.url || i)
        : []
    const img = attachments[0] || ""
    const categories = Array.isArray(item.categories)
      ? item.categories.map((c: any) => c.categoryName || c.name).filter(Boolean)
      : []
    const variants = Array.isArray(item.variants) ? item.variants : Array.isArray(item.items) ? item.items : []

    const copyToClipboard = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        alert("Copied to clipboard")
      } catch (e) {
        console.error("copy failed", e)
      }
    }

    return (
      <div className="bg-gray-50 border-t border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1">
            {img ? (
              <img
                src={img || "/placeholder.svg"}
                alt={item.productDisplayName || item.productName || item.productID}
                className="w-full h-40 object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-40 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                No image
              </div>
            )}
            <div className="mt-4 text-xs text-gray-600">
              <div className="text-gray-900 font-semibold mb-1">Product ID</div>
              <div className="font-mono text-sm text-gray-900 bg-gray-200 p-2 rounded mb-3 break-all">
                {item.productID || item.productId || "-"}
              </div>
              <button
                onClick={() => {
                  window.location.href = "/admin/integrations/kgen/transactions"
                }}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
              >
                View Transactions
              </button>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-black">
                  {item.productDisplayName || item.productName || "Unnamed product"}
                </h3>
                <div className="text-sm text-gray-600 mt-1">{categories.join(" • ")}</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">
              {item.descriptionText || item.description || ""}
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Variants</h4>
              {variants.length === 0 ? (
                <div className="text-sm text-gray-600">No variants</div>
              ) : (
                <div className="overflow-auto border border-gray-300 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-xs text-gray-900 border-b border-gray-300">
                      <tr>
                        <th className="p-3 text-left font-semibold">Variant</th>
                        <th className="p-3 text-left font-semibold">Price</th>
                        <th className="p-3 text-left font-semibold">MRP</th>
                        <th className="p-3 text-left font-semibold">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {variants.map((v: any, i: number) => (
                        <tr key={v.variantID || v.id || i} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-gray-900">
                            {v.variantDisplayName || v.variantName || v.name || "-"}
                          </td>
                          <td className="p-3 text-gray-900">
                            {v.price ? `₹${Number(v.price).toLocaleString("en-IN")}` : "-"}
                          </td>
                          <td className="p-3 text-gray-900">
                            {v.mrp ? `₹${Number(v.mrp).toLocaleString("en-IN")}` : "-"}
                          </td>
                          <td className="p-3 text-gray-900">{v.stock ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-300 rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 text-sm">Redemption Instructions</h5>
                <div className="text-xs text-gray-600 mt-3 whitespace-pre-wrap">
                  {item.redemptionInstructions || item.redeemInstructions || "—"}
                </div>
              </div>
              <div className="bg-white border border-gray-300 rounded-lg p-4">
                <h5 className="font-semibold text-gray-900 text-sm">Terms & Conditions</h5>
                <div className="text-xs text-gray-600 mt-3 whitespace-pre-wrap">
                  {item.termsAndConditions || item.terms || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 sticky top-0 z-40 bg-white/95 backdrop-blur">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/admin/integrations"
                className="text-sm px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-black transition-colors"
              >
                ← Back
              </a>
              <div>
                <h1 className="text-3xl font-bold text-black">eXlr8 Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">KGen Integration</p>
              </div>
            </div>
            <button
              onClick={() => {
                fetchProducts()
                fetchSummary()
              }}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
            >
              <RotateCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <StatCard title="Total Products" value={items.length} href="/admin/integrations/kgen/products" />
            <StatCard title="Total Orders" value={totalOrders} href="/admin/integrations/kgen/orders" />
            <StatCard title="Total Payments" value={totalPayments} href="/admin/integrations/kgen/transactions" />
            <StatCard title="Wallet Balance" value={walletDisplay} subtitle={walletSubtitle} />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Revenue</div>
                <div className="text-2xl font-bold mt-2 text-black">
                  {totalRevenue === null ? "—" : `₹${Number(totalRevenue).toLocaleString("en-IN")}`}
                </div>
              </div>
              <div className="text-xs text-gray-500">Last {salesData.length} days</div>
            </div>
            <div className="my-4 flex justify-center">
              <SalesSparkline data={salesData} />
            </div>
            <div className="flex gap-2 mt-6">
              <a
                href="/admin/integrations/kgen/orders"
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium text-center transition-colors"
              >
                Orders
              </a>
              <a
                href="/admin/integrations/kgen/transactions"
                className="flex-1 px-3 py-2 border border-gray-300 hover:border-blue-500 rounded-lg text-sm font-medium text-black text-center transition-colors"
              >
                Transactions
              </a>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search by ID, name, or category..."
              className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:border-blue-500 transition-colors"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n} className="bg-white text-black">
                  {n} rows
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-600">
            Showing {pageItems.length} of {totalRows} results
          </div>
        </div>

        {loading && (
          <div className="py-16 text-center text-gray-500">
            <div className="inline-block">
              <RotateCw className="h-6 w-6 animate-spin" />
            </div>
            <p className="mt-3">Loading products...</p>
          </div>
        )}

        {error && <IntegrationError message={error} />}

        {!loading && !error && items && (
          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-300">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-gray-700 font-semibold">
                      Product ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-gray-700 font-semibold">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-gray-700 font-semibold">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-gray-700 font-semibold">
                      Variants
                    </th>
                    <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-gray-700 font-semibold">
                      Face Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-gray-700 font-semibold">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-gray-700 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pageItems.map((it, idx) => {
                    const pid = it.productID || it.productId || it.id || ""
                    const name = it.name || it.title || it.productName || "-"
                    const category = it.category || it.categoryName || it.segment || "-"
                    const variantsArr = Array.isArray(it.variants)
                      ? it.variants
                      : Array.isArray(it.items)
                        ? it.items
                        : Array.isArray(it.products)
                          ? it.products
                          : []
                    const variantsCount = variantsArr.length || it.variantCount || it.variants_count || 0
                    const face =
                      it.faceValue || it.price || it.mrp || (variantsArr[0]?.faceValue ?? variantsArr[0]?.price) || "-"
                    const status =
                      it.active === false ? "inactive" : it.status || it.availability || (it.active ? "active" : "-")
                    const rowId = pid || String(idx)

                    return (
                      <React.Fragment key={rowId}>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-gray-900">{pid || "-"}</td>
                          <td className="px-6 py-4 text-gray-900">{name}</td>
                          <td className="px-6 py-4 text-gray-600 text-sm">{category}</td>
                          <td className="px-6 py-4 text-gray-900">{variantsCount}</td>
                          <td className="px-6 py-4 font-semibold text-blue-600">
                            {typeof face === "number" ? `₹${face.toLocaleString("en-IN")}` : face}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <DetailsButton rowId={rowId} item={it} />
                          </td>
                        </tr>

                        <tr>
                          <td colSpan={7} className="p-0">
                            <DetailsRow item={it} rowId={rowId} />
                          </td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && (!items || items.length === 0) && (
          <div className="py-16 text-center text-gray-600 bg-white border border-gray-300 rounded-lg">
            No products returned.
          </div>
        )}

        {/* Pagination controls */}
        {hasMore !== null && (
          <div className="mt-6 flex items-center justify-center">
            {hasMore ? (
              <button
                onClick={() => fetchProducts(cursor || undefined, true)}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Load more
              </button>
            ) : (
              <div className="text-sm text-gray-500">No more pages</div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="px-3 py-2 border border-gray-300 hover:border-blue-500 disabled:opacity-50 rounded-lg text-sm text-black transition-colors"
            >
              First
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 border border-gray-300 hover:border-blue-500 disabled:opacity-50 rounded-lg text-sm text-black transition-colors"
            >
              Prev
            </button>
            <div className="text-sm text-gray-600">Page</div>
            <input
              value={currentPage}
              onChange={(e) => {
                const v = Number(e.target.value) || 1
                setCurrentPage(Math.min(Math.max(1, v), totalPages))
              }}
              className="w-14 px-2 py-2 bg-white border border-gray-300 rounded-lg text-black text-sm focus:outline-none focus:border-blue-500 transition-colors text-center"
            />
            <div className="text-sm text-gray-600">of {totalPages}</div>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-2 border border-gray-300 hover:border-blue-500 disabled:opacity-50 rounded-lg text-sm text-black transition-colors"
            >
              Next
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-3 py-2 border border-gray-300 hover:border-blue-500 disabled:opacity-50 rounded-lg text-sm text-black transition-colors"
            >
              Last
            </button>
          </div>
          <div className="text-sm text-gray-600">
            {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows}
          </div>
        </div>
      </div>
    </div>
  )
}