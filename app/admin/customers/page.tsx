"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpDown, Eye, Loader2, Search, ShieldCheck, Store, Users } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { apiFetch } from "@/lib/api-client"
import { AdminPeopleResponseSchema, type AdminPerson } from "@/lib/admin-people"

type SortField = "name" | "email" | "role" | "createdAt" | "orders" | "totalSpent"
const accessFilters = [
  ["all", "Everyone"], ["staff", "Employees / staff"], ["dashboard", "Dashboard access"],
  ["store", "Store access"], ["privileged", "Admins / vendors"], ["users", "Other users"],
] as const
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })
function joined(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not recorded"
}

export default function AdminCustomers() {
  const { user, isLoading: authLoading } = useAuth()
  const canManage = user?.role === "admin" || user?.role === "superadmin"
  const [people, setPeople] = useState<AdminPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [access, setAccess] = useState("all")
  const [sort, setSort] = useState<SortField>("name")
  const [direction, setDirection] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (authLoading || !canManage) return
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ search: query, access, sort, direction, limit: String(pageSize), offset: String(page * pageSize) })
        const response = await apiFetch(`/api/admin/customers?${params}`, { signal: controller.signal })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || "Could not load the people directory")
        const result = AdminPeopleResponseSchema.parse(data)
        if (controller.signal.aborted) return
        if (page > 0 && page * pageSize >= result.total) { setPage(Math.max(0, Math.ceil(result.total / pageSize) - 1)); return }
        setPeople(result.items)
        setTotal(result.total)
      } catch (cause) {
        if (controller.signal.aborted) return
        setPeople([])
        setTotal(0)
        setError(cause instanceof Error ? cause.message : "Could not load the people directory")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    load()
    return () => controller.abort()
  }, [authLoading, canManage, query, access, sort, direction, page, pageSize, reload])

  const changeSort = (field: SortField) => {
    setDirection(sort === field && direction === "asc" ? "desc" : "asc")
    setSort(field)
    setPage(0)
  }
  const sortHeading = (field: SortField, label: string) => <th scope="col" aria-sort={sort === field ? direction === "asc" ? "ascending" : "descending" : "none"} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500"><button onClick={() => changeSort(field)} className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3.5 w-3.5" /></button></th>

  if (authLoading) return null
  if (!canManage) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">A full administrator login is required to view people and their access.</div>

  return <div className="mx-auto max-w-[1600px] space-y-5 p-2 sm:p-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold text-gray-950">Customers & people</h1><p className="mt-1 text-sm text-gray-600">All users, employees, staff, administrators and vendors, with dashboard and store access.</p></div>
      <button onClick={() => setReload(value => value + 1)} disabled={loading} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Refresh</button>
    </header>
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-4">
        <label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input aria-label="Search everyone" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search all names, emails, Employee IDs or departments" className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm" /></label>
        <select aria-label="Filter people by access" value={access} onChange={event => { setAccess(event.target.value); setPage(0) }} className="h-10 rounded-md border border-gray-300 px-3 text-sm">{accessFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <span className="text-sm text-gray-500">{total.toLocaleString("en-IN")} people found</span>
      </div>
      <p className="border-b border-gray-100 px-4 py-3 text-xs text-gray-500">Linked staff profiles appear under their login account. Staff without a linked login are also listed; their access is configured only. Inactive accounts cannot sign in.</p>
      {loading ? <div className="flex h-64 items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" />Loading everyone...</div> : error ? <div role="alert" className="m-4 rounded-md bg-red-50 p-4 text-red-800">{error}</div> : <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr>{sortHeading("name", "Person")}{sortHeading("email", "Contact")}{sortHeading("role", "Role / status")}<th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Dashboard access</th><th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Store access</th>{sortHeading("orders", "Orders")}{sortHeading("totalSpent", "Total spent")}{sortHeading("createdAt", "Joined")}<th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">View</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {!people.length ? <tr><td colSpan={9} className="p-10 text-center text-gray-500">No people match these filters.</td></tr> : people.map(person => {
              const fullAdmin = person.role === "admin" || person.role === "superadmin"
              return <tr key={person.id} className="align-top hover:bg-gray-50/60">
                <td className="min-w-56 px-4 py-4"><div className="font-semibold text-gray-900">{person.name || person.email || "Unnamed person"}</div>
                  {person.address && <p className="mt-1 max-w-xs text-xs text-gray-500">{person.address}</p>}
                  {person.staffProfiles.length > 0 && <div className="mt-2 space-y-2">{person.staffProfiles.map(profile => <div key={profile.id} className="rounded border border-blue-100 bg-blue-50 p-2 text-xs text-blue-900"><p className="flex items-center gap-1 font-semibold"><Users className="h-3 w-3" />{profile.employeeId || "Staff"}{profile.name && profile.name !== person.name ? ` - ${profile.name}` : ""}</p>{profile.email && <p className="mt-1 break-all">{profile.email}</p>}{(profile.department || profile.role) && <p className="mt-1 text-blue-700">{[profile.department, profile.role].filter(Boolean).join(" / ")}</p>}</div>)}</div>}
                </td>
                <td className="px-4 py-4 text-sm"><p className="break-all text-gray-800">{person.email || "No email recorded"}</p>{person.phone && <p className="mt-1 text-gray-500">{person.phone}</p>}{!person.userId && <p className="mt-2 text-xs font-semibold text-amber-700">No linked login</p>}</td>
                <td className="px-4 py-4"><span className={`rounded px-2 py-1 text-xs font-semibold capitalize ${fullAdmin ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-700"}`}>{person.role}</span><p className={`mt-2 text-xs capitalize ${person.status === "active" ? "text-green-700" : "text-red-700"}`}>{person.status}</p></td>
                <td className="min-w-48 px-4 py-4 text-sm">{person.dashboardAccess ? <><p className="flex items-center gap-1 font-semibold text-blue-700"><ShieldCheck className="h-4 w-4" />{fullAdmin ? "All admin pages" : `${person.allowedPages.length} pages`}</p>{!fullAdmin && <details className="mt-2 text-xs text-gray-600"><summary className="cursor-pointer">View allowed pages</summary>{person.allowedPages.length ? <ul className="mt-2 space-y-1">{person.allowedPages.map(path => <li key={path} className="break-all">{path}</li>)}</ul> : <p className="mt-1 text-amber-700">No pages selected</p>}</details>}</> : <span className="text-gray-400">No dashboard access</span>}</td>
                <td className="min-w-40 px-4 py-4 text-sm">{person.storeAccess !== "none" ? <><p className="flex items-center gap-1 font-semibold text-amber-700"><Store className="h-4 w-4" />{person.storeAccess === "all" ? "All stores" : `${person.storeIds.length} selected stores`}</p>{person.storeAccess === "selected" && <details className="mt-2 text-xs text-gray-600"><summary className="cursor-pointer">View store IDs</summary><ul className="mt-2 space-y-1">{person.storeIds.map(id => <li key={id} className="break-all">{id}</li>)}</ul></details>}</> : <span className="text-gray-400">No store access</span>}</td>
                <td className="px-4 py-4 text-sm">{person.orders}</td><td className="whitespace-nowrap px-4 py-4 text-sm">{money.format(person.totalSpent)}</td><td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">{joined(person.createdAt)}</td>
                <td className="px-4 py-4 text-right"><Link href={person.userId ? `/admin/customers/${encodeURIComponent(person.userId)}` : "/admin/employees"} title={person.userId ? "View account" : "View employee records"} className="inline-flex rounded border border-gray-200 p-2 text-indigo-700 hover:bg-indigo-50"><Eye className="h-4 w-4" /></Link></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4 text-sm text-gray-600">
        <label className="flex items-center gap-2">Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }} className="rounded border border-gray-300 px-2 py-1">{[20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        <span>{total ? `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, total)} of ${total.toLocaleString("en-IN")}` : "0 of 0"}</span>
        <div className="flex gap-2"><button onClick={() => setPage(value => Math.max(0, value - 1))} disabled={loading || page === 0} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40">Previous</button><button onClick={() => setPage(value => value + 1)} disabled={loading || (page + 1) * pageSize >= total} className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40">Next</button></div>
      </footer>
    </section>
  </div>
}
