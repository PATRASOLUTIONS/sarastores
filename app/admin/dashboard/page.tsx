"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Box,
  CreditCard,
  Download,
  IndianRupee,
  Loader2,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"

interface Dashboard {
  range: { from: string; to: string }
  totals: {
    revenue: number
    orders: number
    averageOrderValue: number
    pipeline: number
    lost: number
    products: number
    activeProducts: number
    lowStock: number
    customers: number
    newCustomers: number
  }
  deltas: { revenue: number | null; orders: number | null; averageOrderValue: number | null }
  byStatus: { status: string; count: number; value: number }[]
  daily: { date: string; orders: number; revenue: number; booked: number }[]
  payments: { method: string; count: number; value: number }[]
  topProducts: { name: string; units: number; revenue: number; productId?: string }[]
  recent: {
    id: string
    orderId: string | null
    status: string
    total: number
    createdAt: string
    customerName: string
  }[]
}

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "All time", days: 3650 },
]

const STATUS_COLOURS: Record<string, string> = {
  delivered: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-purple-100 text-purple-800",
  pending: "bg-amber-100 text-amber-800",
  queued_for_external: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-red-100 text-red-800",
  refunded: "bg-red-100 text-red-800",
}

const PIE_COLOURS = ["#0F2557", "#FF6A2C", "#2E7D32", "#6A1B9A", "#0288D1", "#B71C1C"]

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

const compactInr = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preset, setPreset] = useState(30)
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * 86400000)))
  const [to, setTo] = useState(() => isoDay(new Date()))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/dashboard?from=${from}&to=${to}`)
      const body = await res.json()
      if (!res.ok || !body?.success) {
        setError(body?.error || "Could not load dashboard")
        return
      }
      setData(body)
    } catch {
      setError("Could not reach the server")
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const applyPreset = (days: number) => {
    setPreset(days)
    setFrom(isoDay(new Date(Date.now() - (days - 1) * 86400000)))
    setTo(isoDay(new Date()))
  }

  const exportExcel = async () => {
    if (!data) return
    try {
      // ~200 KB parser, fetched only when someone actually clicks export.
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()
      const add = (rows: any[], name: string, widths: number[]) => {
        if (rows.length === 0) return
        const ws = XLSX.utils.json_to_sheet(rows)
        ws["!cols"] = widths.map((wch) => ({ wch }))
        XLSX.utils.book_append_sheet(wb, ws, name)
      }

      add(
        [
          { Metric: "Date range", Value: `${from} to ${to}` },
          { Metric: "Realised revenue (delivered/completed)", Value: Math.round(data.totals.revenue) },
          { Metric: "Awaiting fulfilment", Value: Math.round(data.totals.pipeline) },
          { Metric: "Cancelled / returned", Value: Math.round(data.totals.lost) },
          { Metric: "Orders", Value: data.totals.orders },
          { Metric: "Average order value", Value: Math.round(data.totals.averageOrderValue) },
          { Metric: "Registered customers", Value: data.totals.customers },
          { Metric: "New customers in range", Value: data.totals.newCustomers },
          {
            Metric: "Products (active / total)",
            Value: `${data.totals.activeProducts} / ${data.totals.products}`,
          },
          { Metric: "Low stock (5 or fewer)", Value: data.totals.lowStock },
          { Metric: "Generated", Value: new Date().toLocaleString("en-IN") },
        ],
        "Summary",
        [42, 28],
      )
      add(
        data.daily.map((d) => ({
          Date: d.date,
          Orders: d.orders,
          "Realised revenue": Math.round(d.revenue),
          "Total booked": Math.round(d.booked),
        })),
        "Daily",
        [12, 10, 18, 16],
      )
      add(
        data.byStatus.map((s) => ({ Status: s.status, Orders: s.count, Value: Math.round(s.value) })),
        "By status",
        [22, 10, 16],
      )
      add(
        data.payments.map((p) => ({ Method: p.method, Orders: p.count, Value: Math.round(p.value) })),
        "Payment methods",
        [18, 10, 16],
      )
      add(
        data.topProducts.map((p, i) => ({
          Rank: i + 1,
          Product: p.name,
          "Units sold": p.units,
          Revenue: Math.round(p.revenue),
        })),
        "Top products",
        [6, 50, 12, 16],
      )
      add(
        data.recent.map((o) => ({
          "Order ID": o.orderId ?? o.id,
          Customer: o.customerName,
          Status: o.status,
          Total: o.total,
          Date: new Date(o.createdAt).toLocaleString("en-IN"),
        })),
        "Recent orders",
        [22, 26, 14, 12, 22],
      )

      XLSX.writeFile(wb, `sara-dashboard_${from}_to_${to}.xlsx`)
      toast.success("Report downloaded")
    } catch {
      toast.error("Could not build the report")
    }
  }

  const chartData = useMemo(
    () =>
      (data?.daily ?? []).map((d) => ({
        ...d,
        label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
      })),
    [data],
  )

  const cards = data
    ? [
        {
          label: "Realised revenue",
          value: compactInr(data.totals.revenue),
          hint: "Delivered and completed orders",
          delta: data.deltas.revenue,
          icon: <IndianRupee className="h-5 w-5" />,
          href: "/admin/orders",
        },
        {
          label: "Awaiting fulfilment",
          value: compactInr(data.totals.pipeline),
          hint: "Paid or in progress, not yet delivered",
          delta: null,
          icon: <TrendingUp className="h-5 w-5" />,
          href: "/admin/orders",
        },
        {
          label: "Orders",
          value: data.totals.orders.toLocaleString("en-IN"),
          hint: `Avg ${inr(data.totals.averageOrderValue)} per delivered order`,
          delta: data.deltas.orders,
          icon: <ShoppingBag className="h-5 w-5" />,
          href: "/admin/orders",
        },
        {
          label: "Customers",
          value: data.totals.customers.toLocaleString("en-IN"),
          hint: `${data.totals.newCustomers} joined in this range`,
          delta: null,
          icon: <Users className="h-5 w-5" />,
          href: "/admin/customers",
        },
        {
          label: "Products",
          value: data.totals.activeProducts.toLocaleString("en-IN"),
          hint: `${data.totals.products} total in catalogue`,
          delta: null,
          icon: <Box className="h-5 w-5" />,
          href: "/admin/products",
        },
        {
          label: "Low stock",
          value: data.totals.lowStock.toLocaleString("en-IN"),
          hint: "Active products with 5 or fewer left",
          delta: null,
          icon: <AlertTriangle className="h-5 w-5" />,
          href: "/admin/products",
        },
      ]
    : []

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            {data
              ? `${new Date(data.range.from).toLocaleDateString("en-IN")} – ${new Date(
                  data.range.to,
                ).toLocaleDateString("en-IN")}`
              : "Loading…"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => applyPreset(p.days)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                preset === p.days
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value)
              setPreset(0)
            }}
            aria-label="From date"
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value)
              setPreset(0)
            }}
            aria-label="To date"
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={!data}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading dashboard…
        </p>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="group rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between text-gray-500">
                  {c.icon}
                  {c.delta != null && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                        c.delta >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {c.delta >= 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(c.delta)}%
                    </span>
                  )}
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-sm font-semibold text-gray-700">{c.label}</p>
                <p className="mt-1 text-xs text-gray-500">{c.hint}</p>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-900">Revenue over time</h2>
              <p className="text-xs text-gray-500">
                Realised counts delivered and completed orders only; booked includes everything placed.
              </p>
              {chartData.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-500">No orders in this range.</p>
              ) : (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRealised" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0F2557" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#0F2557" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gBooked" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF6A2C" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#FF6A2C" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => compactInr(Number(v))}
                        width={70}
                      />
                      <Tooltip
                        formatter={(v: any, name: any) => [
                          inr(Number(v)),
                          name === "revenue" ? "Realised" : "Booked",
                        ]}
                      />
                      <Legend
                        formatter={(v) => (v === "revenue" ? "Realised revenue" : "Total booked")}
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="booked"
                        stroke="#FF6A2C"
                        fill="url(#gBooked)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0F2557"
                        fill="url(#gRealised)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">Payment methods</h2>
              {data.payments.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-500">No payments in this range.</p>
              ) : (
                <>
                  <div className="mt-2 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.payments}
                          dataKey="value"
                          nameKey="method"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {data.payments.map((_, i) => (
                            <Cell key={i} fill={PIE_COLOURS[i % PIE_COLOURS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => inr(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1">
                    {data.payments.map((p, i) => (
                      <li key={p.method} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 capitalize text-gray-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: PIE_COLOURS[i % PIE_COLOURS.length] }}
                          />
                          {p.method}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {compactInr(p.value)} · {p.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/admin/payments"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
                  >
                    Payment history <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Orders by status</h2>
                <Link
                  href="/admin/orders"
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  Manage
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {data.byStatus.map((s) => (
                  <li key={s.status} className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${
                        STATUS_COLOURS[s.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {s.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-600">
                      <span className="font-bold text-gray-900">{s.count}</span> · {compactInr(s.value)}
                    </span>
                  </li>
                ))}
                {data.byStatus.length === 0 && (
                  <li className="text-sm text-gray-500">No orders in this range.</li>
                )}
              </ul>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Best sellers</h2>
                <Link
                  href="/admin/products"
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  Products
                </Link>
              </div>
              <p className="text-xs text-gray-500">By units actually sold in this range.</p>
              <ol className="mt-3 space-y-2">
                {data.topProducts.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-start justify-between gap-2 text-xs">
                    <span className="line-clamp-2 text-gray-700">
                      <span className="mr-1 font-bold text-gray-400">{i + 1}.</span>
                      {p.name}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold text-gray-900">{p.units} sold</span>
                      <span className="text-gray-500">{compactInr(p.revenue)}</span>
                    </span>
                  </li>
                ))}
                {data.topProducts.length === 0 && (
                  <li className="text-sm text-gray-500">Nothing sold in this range.</li>
                )}
              </ol>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Recent orders</h2>
                <Link
                  href="/admin/orders"
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  All orders
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {data.recent.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900">
                          {o.orderId ?? o.id}
                        </span>
                        <span className="block truncate text-gray-500">{o.customerName}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-bold text-gray-900">{compactInr(o.total)}</span>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                            STATUS_COLOURS[String(o.status).toLowerCase()] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {String(o.status).replace(/_/g, " ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {data.recent.length === 0 && (
                  <li className="text-sm text-gray-500">No orders in this range.</li>
                )}
              </ul>
            </section>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Jump to</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "Orders", href: "/admin/orders", icon: <ShoppingBag className="h-4 w-4" /> },
                { label: "Products", href: "/admin/products", icon: <Box className="h-4 w-4" /> },
                { label: "Customers", href: "/admin/customers", icon: <Users className="h-4 w-4" /> },
                { label: "Payments", href: "/admin/payments", icon: <CreditCard className="h-4 w-4" /> },
                { label: "Leads", href: "/admin/leads", icon: <TrendingUp className="h-4 w-4" /> },
                {
                  label: "Complaints",
                  href: "/admin/complaints",
                  icon: <AlertTriangle className="h-4 w-4" />,
                },
                { label: "Coupons", href: "/admin/promotions", icon: <CreditCard className="h-4 w-4" /> },
                {
                  label: "Campaigns",
                  href: "/admin/customer-centric",
                  icon: <Users className="h-4 w-4" />,
                },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {l.icon}
                  {l.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
