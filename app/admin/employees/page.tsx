"use client"

import { useEffect, useMemo, useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import {
  BarChart3,
  Check,
  ChevronRight,
  Download,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react"
import { toast } from "react-hot-toast"
import * as XLSX from "xlsx"
import { apiFetch } from "@/lib/api-client"
import { ADMIN_MENU_PATHS } from "@/components/AdminSidebar"
import type { Employee } from "@/types/employee"

interface StoreLocation {
  id: string
  shopName: string
  locationDescription?: string
  isActive: boolean
}

interface EmployeeForm {
  employeeId: string
  name: string
  email: string
  department: string
  role: string
  status: "active" | "inactive"
  dashboardAccess: boolean
  allowedPages: string[]
  storeAccess: "none" | "selected" | "all"
  storeIds: string[]
}

const EMPTY_FORM: EmployeeForm = {
  employeeId: "",
  name: "",
  email: "",
  department: "",
  role: "Staff",
  status: "active",
  dashboardAccess: false,
  allowedPages: [],
  storeAccess: "none",
  storeIds: [],
}

const pageGroups = Object.entries(
  ADMIN_MENU_PATHS.reduce<Record<string, typeof ADMIN_MENU_PATHS>>((groups, page) => {
    ;(groups[page.section] ||= []).push(page)
    return groups
  }, {}),
)

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<StoreLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const lock = useSubmitLock()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const [editing, setEditing] = useState<Employee | "new" | null>(null)
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [salesEmployee, setSalesEmployee] = useState<Employee | null>(null)
  const [salesOrders, setSalesOrders] = useState<Record<string, any>[]>([])
  const [salesLoading, setSalesLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [employeesResponse, storesResponse] = await Promise.all([
        apiFetch("/api/employees"),
        apiFetch("/api/admin/store-locations"),
      ])
      const [employeeData, storeData] = await Promise.all([
        employeesResponse.json(),
        storesResponse.json(),
      ])
      if (!employeesResponse.ok) throw new Error(employeeData?.error || "Could not load staff")
      setEmployees(Array.isArray(employeeData) ? employeeData : [])
      setStores(storesResponse.ok && Array.isArray(storeData?.stores) ? storeData.stores : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load staff")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, allowedPages: [], storeIds: [] })
    setEditing("new")
  }

  const openEdit = (employee: Employee) => {
    setForm({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      department: employee.department || "",
      role: employee.role || "Staff",
      status: employee.status,
      dashboardAccess: employee.dashboardAccess === true,
      allowedPages: employee.allowedPages || [],
      storeAccess: employee.storeAccess || "none",
      storeIds: employee.storeIds || [],
    })
    setEditing(employee)
  }

  const closeEditor = () => {
    if (saving) return
    setEditing(null)
    setForm({ ...EMPTY_FORM, allowedPages: [], storeIds: [] })
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.employeeId.trim() || !form.name.trim() || !form.email.trim()) {
      toast.error("Employee ID, name and email are required")
      return
    }
    if (form.dashboardAccess && form.allowedPages.length === 0) {
      toast.error("Select at least one dashboard page")
      return
    }
    if (form.storeAccess === "selected" && form.storeIds.length === 0) {
      toast.error("Select at least one store")
      return
    }

    if (!lock.acquire()) return
    setSaving(true)
    try {
      const id = editing !== "new" && editing?._id
      const response = await apiFetch(id ? `/api/employees/${id}` : "/api/employees", {
        method: id ? "PUT" : "POST",
        json: form,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || "Could not save staff member")
      toast.success(id ? "Staff access updated" : "Staff member created")
      setEditing(null)
      setForm({ ...EMPTY_FORM, allowedPages: [], storeIds: [] })
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save staff member")
    } finally {
      lock.release()
      setSaving(false)
    }
  }

  const remove = async (employee: Employee) => {
    if (!employee._id || !confirm(`Delete ${employee.name} and their staff login?`)) return
    try {
      const response = await apiFetch(`/api/employees/${employee._id}`, { method: "DELETE" })
      if (!response.ok) throw new Error()
      toast.success("Staff member deleted")
      await load()
    } catch {
      toast.error("Could not delete staff member")
    }
  }

  const togglePage = (path: string) => {
    setForm((current) => ({
      ...current,
      allowedPages: current.allowedPages.includes(path)
        ? current.allowedPages.filter((page) => page !== path)
        : [...current.allowedPages, path],
    }))
  }

  const toggleGroup = (paths: string[]) => {
    const allSelected = paths.every((path) => form.allowedPages.includes(path))
    setForm((current) => ({
      ...current,
      allowedPages: allSelected
        ? current.allowedPages.filter((path) => !paths.includes(path))
        : [...new Set([...current.allowedPages, ...paths])],
    }))
  }

  const toggleStore = (id: string) => {
    setForm((current) => ({
      ...current,
      storeIds: current.storeIds.includes(id)
        ? current.storeIds.filter((storeId) => storeId !== id)
        : [...current.storeIds, id],
    }))
  }

  const fetchSales = async (employee: Employee) => {
    setSalesEmployee(employee)
    setSalesLoading(true)
    try {
      const response = await apiFetch(`/api/orders?employeeId=${encodeURIComponent(employee.employeeId)}&limit=200`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error)
      setSalesOrders(Array.isArray(data) ? data : [])
    } catch {
      setSalesOrders([])
      toast.error("Could not load employee sales")
    } finally {
      setSalesLoading(false)
    }
  }

  const downloadTemplate = () => {
    const sheet = XLSX.utils.json_to_sheet([
      { Name: "Store Staff", Email: "staff@example.com", "Employee ID": "SM123456" },
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Employees")
    XLSX.writeFile(workbook, "employee_upload_template.xlsx")
  }

  const bulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const toastId = toast.loading("Importing staff...")
    try {
      const workbook = XLSX.read(await file.arrayBuffer())
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]])
      let success = 0
      let failed = 0
      for (const row of rows) {
        const emailKey = Object.keys(row).find((key) => key.toLowerCase().includes("email"))
        const email = emailKey ? row[emailKey] : ""
        if (!email) continue
        const response = await apiFetch("/api/employees", {
          method: "POST",
          json: {
            ...EMPTY_FORM,
            name: row.Name || row.name || email.split("@")[0],
            email,
            employeeId: row["Employee ID"] || row.employeeId || `SM${Math.floor(100000 + Math.random() * 900000)}`,
            department: "Store Operations",
          },
        })
        if (response.ok) success += 1
        else failed += 1
      }
      toast.success(`${success} imported, ${failed} failed`, { id: toastId })
      setBulkOpen(false)
      await load()
    } catch {
      toast.error("Could not process that spreadsheet", { id: toastId })
    } finally {
      event.target.value = ""
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return employees.filter((employee) => {
      const matches = !needle || `${employee.name} ${employee.email} ${employee.employeeId} ${employee.department}`.toLowerCase().includes(needle)
      return matches && (status === "all" || employee.status === status)
    })
  }, [employees, query, status])

  const storeLabel = (employee: Employee) => {
    if (employee.storeAccess === "all") return "All stores"
    if (employee.storeAccess === "selected") return `${employee.storeIds?.length || 0} stores`
    return "No store access"
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-2 sm:p-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">People & access</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Staff access</h1>
          <p className="mt-1 text-sm text-gray-600">Assign exact admin pages and store visibility to each staff login.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Upload className="h-4 w-4" /> Bulk import</button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"><Plus className="h-4 w-4" /> Add staff</button>
        </div>
      </header>

      <section className="grid gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 sm:grid-cols-3">
        <div className="bg-white p-4"><p className="text-xs font-semibold text-gray-500">Total staff</p><p className="mt-1 text-2xl font-bold text-gray-950">{employees.length}</p></div>
        <div className="bg-white p-4"><p className="text-xs font-semibold text-gray-500">Dashboard users</p><p className="mt-1 text-2xl font-bold text-gray-950">{employees.filter((employee) => employee.dashboardAccess).length}</p></div>
        <div className="bg-white p-4"><p className="text-xs font-semibold text-gray-500">Store-scoped users</p><p className="mt-1 text-2xl font-bold text-gray-950">{employees.filter((employee) => employee.storeAccess === "selected").length}</p></div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, ID or department" className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-gray-500" /></label>
        <div className="flex rounded-md border border-gray-300 p-1">{(["all", "active", "inactive"] as const).map((value) => <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded px-3 py-1.5 text-xs font-semibold capitalize ${status === value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{value}</button>)}</div>
      </div>

      <section className="overflow-hidden border-y border-gray-200 bg-white">
        <div className="hidden grid-cols-[minmax(230px,1.2fr)_minmax(180px,1fr)_minmax(230px,1.1fr)_130px] gap-4 bg-gray-50 px-4 py-2 text-xs font-bold uppercase text-gray-500 md:grid"><span>Staff member</span><span>Assignment</span><span>Access</span><span className="text-right">Actions</span></div>
        {loading ? <div className="flex h-52 items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading staff...</div> : filtered.length === 0 ? <div className="py-16 text-center text-sm text-gray-500">No staff members match these filters.</div> : filtered.map((employee) => (
          <div key={employee._id} className="grid gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(230px,1.2fr)_minmax(180px,1fr)_minmax(230px,1.1fr)_130px] md:items-center md:gap-4">
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-900 text-sm font-bold text-white">{employee.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-950">{employee.name}</p><p className="truncate text-xs text-gray-500">{employee.email} · {employee.employeeId}</p></div></div>
            <div><p className="text-sm font-medium text-gray-800">{employee.department || "Unassigned"}</p><p className="text-xs text-gray-500">{employee.role || "Staff"}</p></div>
            <div className="flex flex-wrap gap-1.5"><span className={`rounded px-2 py-1 text-xs font-semibold ${employee.dashboardAccess ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{employee.dashboardAccess ? `${employee.allowedPages?.length || 0} pages` : "No dashboard"}</span><span className="rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{storeLabel(employee)}</span><span className={`rounded px-2 py-1 text-xs font-semibold ${employee.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{employee.status}</span></div>
            <div className="flex justify-start gap-1 md:justify-end"><button type="button" title="View sales" onClick={() => fetchSales(employee)} className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><BarChart3 className="h-4 w-4" /></button><button type="button" title="Edit access" onClick={() => openEdit(employee)} className="rounded-md border border-gray-200 p-2 text-gray-700 hover:bg-gray-50"><Pencil className="h-4 w-4" /></button><button type="button" title="Delete" onClick={() => remove(employee)} className="rounded-md border border-red-200 p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
          </div>
        ))}
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={editing === "new" ? "Create staff member" : "Edit staff member"}>
          <form onSubmit={save} className="mx-auto my-2 w-full max-w-6xl overflow-hidden rounded-md bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><div><h2 className="text-lg font-bold text-gray-950">{editing === "new" ? "Create staff member" : `Edit ${editing.name}`}</h2><p className="text-xs text-gray-500">Identity, dashboard permissions and store scope</p></div><button type="button" title="Close" onClick={closeEditor} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-5 border-b border-gray-200 p-5 lg:border-b-0 lg:border-r">
                <section><h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><UserRound className="h-4 w-4" /> Identity</h3><div className="mt-3 grid gap-3"><label className="text-xs font-semibold text-gray-600">Employee ID *<input value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm font-normal" /></label><label className="text-xs font-semibold text-gray-600">Full name *<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm font-normal" /></label><label className="text-xs font-semibold text-gray-600">Login email *<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm font-normal" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-gray-600">Department<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm font-normal" /></label><label className="text-xs font-semibold text-gray-600">Job title<input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm font-normal" /></label></div><label className="text-xs font-semibold text-gray-600">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EmployeeForm["status"] })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm font-normal"><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div></section>
                {editing === "new" && <div className="rounded-md border border-blue-200 bg-blue-50 p-3"><p className="flex items-center gap-2 text-xs font-bold text-blue-900"><KeyRound className="h-4 w-4" /> Temporary login</p><p className="mt-1 text-xs text-blue-800">Initial password: <strong>{form.employeeId || "EMPLOYEE_ID"}@12345</strong>. Send it securely and ask staff to change it.</p></div>}
              </div>

              <div className="space-y-6 p-5">
                <section><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><ShieldCheck className="h-4 w-4" /> Admin page access</h3><p className="mt-1 text-xs text-gray-500">Direct URLs are blocked unless the page is selected.</p></div><label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={form.dashboardAccess} onChange={(event) => setForm({ ...form, dashboardAccess: event.target.checked, allowedPages: event.target.checked ? form.allowedPages : [] })} className="h-4 w-4" /> Dashboard access</label></div>
                  {form.dashboardAccess ? <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-gray-200"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-gray-50 px-3 py-2"><span className="text-xs font-semibold text-gray-600">{form.allowedPages.length} pages selected</span><button type="button" onClick={() => setForm({ ...form, allowedPages: form.allowedPages.length === ADMIN_MENU_PATHS.length ? [] : ADMIN_MENU_PATHS.map((page) => page.path) })} className="text-xs font-bold text-blue-700">{form.allowedPages.length === ADMIN_MENU_PATHS.length ? "Clear all" : "Select all"}</button></div>{pageGroups.map(([group, pages]) => { const paths = pages.map((page) => page.path); const all = paths.every((path) => form.allowedPages.includes(path)); return <div key={group} className="border-b border-gray-100 p-3 last:border-0"><button type="button" onClick={() => toggleGroup(paths)} className="mb-2 flex w-full items-center justify-between text-left text-xs font-bold uppercase text-gray-500"><span>{group}</span><span className="normal-case text-blue-700">{all ? "Clear group" : "Select group"}</span></button><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{pages.map((page) => <label key={page.path} className={`flex cursor-pointer items-center gap-2 rounded border px-2.5 py-2 text-xs ${form.allowedPages.includes(page.path) ? "border-blue-300 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}><input type="checkbox" checked={form.allowedPages.includes(page.path)} onChange={() => togglePage(page.path)} className="h-3.5 w-3.5" /><span className="truncate">{page.name}</span></label>)}</div></div>})}</div> : <div className="mt-3 rounded-md bg-gray-50 p-4 text-sm text-gray-500">This staff member cannot open the admin dashboard.</div>}
                </section>

                <section className="border-t border-gray-200 pt-5"><div><h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Store className="h-4 w-4" /> Store access</h3><p className="mt-1 text-xs text-gray-500">Controls which store-scoped records this staff member can view.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{([['none','No stores'],['selected','Selected stores'],['all','All stores']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setForm({ ...form, storeAccess: value, storeIds: value === "selected" ? form.storeIds : [] })} className={`rounded-md border px-3 py-2 text-sm font-semibold ${form.storeAccess === value ? "border-amber-400 bg-amber-50 text-amber-900" : "border-gray-200 text-gray-600"}`}>{label}</button>)}</div>
                  {form.storeAccess === "selected" && <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-gray-200"><div className="sticky top-0 flex items-center justify-between border-b bg-gray-50 px-3 py-2"><span className="text-xs font-semibold text-gray-600">{form.storeIds.length} stores selected</span><button type="button" onClick={() => setForm({ ...form, storeIds: form.storeIds.length === stores.filter((store) => store.isActive).length ? [] : stores.filter((store) => store.isActive).map((store) => store.id) })} className="text-xs font-bold text-amber-800">{form.storeIds.length ? "Clear" : "Select all active"}</button></div><div className="grid gap-2 p-3 sm:grid-cols-2">{stores.filter((store) => store.isActive).map((store) => <label key={store.id} className={`flex cursor-pointer gap-2 rounded border p-2.5 ${form.storeIds.includes(store.id) ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}><input type="checkbox" checked={form.storeIds.includes(store.id)} onChange={() => toggleStore(store.id)} className="mt-0.5 h-4 w-4" /><span><span className="block text-xs font-semibold text-gray-900">{store.shopName}</span><span className="block text-[11px] text-gray-500">{store.locationDescription || "No address"}</span></span></label>)}</div></div>}
                </section>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4"><p className="hidden text-xs text-gray-500 sm:block">Permission changes take effect after the staff member signs in again.</p><div className="ml-auto flex gap-2"><button type="button" onClick={closeEditor} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{editing === "new" ? "Create staff" : "Save access"}</button></div></div>
          </form>
        </div>
      )}

      {salesEmployee && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Employee sales"><div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-md bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold text-gray-950">Sales by {salesEmployee.name}</h2><p className="text-xs text-gray-500">{salesEmployee.employeeId}</p></div><button type="button" title="Close" onClick={() => { setSalesEmployee(null); setSalesOrders([]) }}><X className="h-5 w-5" /></button></div>{salesLoading ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : salesOrders.length === 0 ? <p className="p-8 text-center text-sm text-gray-500">No sales found.</p> : <div className="divide-y">{salesOrders.map((order) => <div key={String(order.id)} className="grid grid-cols-[1fr_auto] gap-3 px-5 py-3"><div><p className="text-sm font-semibold">{String(order.orderId || order.id)}</p><p className="text-xs text-gray-500">{new Date(order.createdAt || order.date).toLocaleString()}</p></div><div className="text-right"><p className="text-sm font-bold">₹{Number(order.total || 0).toLocaleString("en-IN")}</p><p className="text-xs capitalize text-gray-500">{String(order.status || "pending")}</p></div></div>)}</div>}</div></div>}

      {bulkOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Bulk import staff"><div className="w-full max-w-lg rounded-md bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-bold text-gray-950">Bulk import staff</h2><button type="button" title="Close" onClick={() => setBulkOpen(false)}><X className="h-5 w-5" /></button></div><div className="space-y-3 p-5"><button type="button" onClick={downloadTemplate} className="flex w-full items-center gap-3 rounded-md border border-gray-200 p-4 text-left hover:bg-gray-50"><FileSpreadsheet className="h-5 w-5 text-blue-700" /><span className="flex-1"><span className="block text-sm font-semibold">Download spreadsheet template</span><span className="block text-xs text-gray-500">Name, email and employee ID columns</span></span><Download className="h-4 w-4" /></button><label className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-gray-300 p-5 hover:border-gray-500"><Upload className="h-5 w-5" /><span className="flex-1 text-sm font-semibold">Choose completed Excel file</span><ChevronRight className="h-4 w-4" /><input type="file" accept=".xlsx,.xls" onChange={bulkUpload} className="hidden" /></label><p className="text-xs text-gray-500">Imported staff start with no dashboard or store access. Assign permissions after import.</p></div></div></div>}
    </div>
  )
}
