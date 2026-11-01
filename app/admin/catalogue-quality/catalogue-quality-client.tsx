"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ClipboardCheck, Download, Loader2, Search, ShieldCheck } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { unpackQualityReport, type QualityReport } from "@/lib/catalogue-quality"
import { catalogueReviewCsv, DEFAULT_REVIEW_FILTERS, filterReviewProducts, matchingReviewIssues, QUALITY_AREAS, reviewPriority, type ReviewFilters, type ReviewSort } from "@/lib/catalogue-review"
import CatalogueReviewOverview from "./catalogue-review-overview"

const severityLabel = { blocked: "Blocking issue", improve: "Improve", review: "Human review" }
const severityClass = { blocked: "border-red-200 bg-red-50 text-red-800", improve: "border-amber-200 bg-amber-50 text-amber-900", review: "border-blue-200 bg-blue-50 text-blue-900" }
const humanRule = (value: string) => value.replace(/-/g, " ")
const PAGE_SIZE = 25

export default function CatalogueQualityClient() {
  const [report, setReport] = useState<QualityReport | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [division, setDivision] = useState("")
  const [brand, setBrand] = useState("")
  const [severity, setSeverity] = useState("")
  const [rule, setRule] = useState("")
  const [visibility, setVisibility] = useState("all")
  const [status, setStatus] = useState("")
  const [area, setArea] = useState("")
  const [sort, setSort] = useState<ReviewSort>("priority")
  const [page, setPage] = useState(1)

  const focusReview = (next: Partial<ReviewFilters> = {}, scroll = true) => {
    const filters = { ...DEFAULT_REVIEW_FILTERS, ...next }
    setSearch(filters.search); setDivision(filters.division); setBrand(filters.brand); setSeverity(filters.severity)
    setRule(filters.rule); setVisibility(filters.visibility); setStatus(filters.status); setArea(filters.area); setSort(filters.sort); setPage(1)
    if (scroll) document.getElementById("product-review")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const scan = async () => {
    if (scanning) return
    setScanning(true); setError(""); setReport(null)
    try {
      const response = await apiFetch("/api/admin/catalogue-quality", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Catalogue scan failed")
      setReport(unpackQualityReport(data)); focusReview({}, false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Catalogue scan failed") }
    finally { setScanning(false) }
  }
  const reviewFilters = useMemo<ReviewFilters>(() => ({ search, division, brand, visibility, severity, rule, status, area, sort }), [search, division, brand, visibility, severity, rule, status, area, sort])
  const products = useMemo(() => filterReviewProducts(report?.products || [], reviewFilters), [report, reviewFilters])
  const divisions = useMemo(() => [...new Set(report?.products.map(product => product.division).filter(Boolean) || [])].sort(), [report])
  const brands = useMemo(() => [...new Set(report?.products.map(product => product.brand).filter(Boolean) || [])].sort(), [report])
  const visibleIssues = (product: QualityReport["products"][number]) => matchingReviewIssues(product, reviewFilters)
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const exportReport = (worksheet = false) => {
    if (!report) return
    const content = catalogueReviewCsv(products, reviewFilters, report.environment, report.scannedAt, worksheet)
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a"); link.href = url; link.download = `sara-catalogue-${worksheet ? "review-worksheet" : "quality"}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click(); URL.revokeObjectURL(url)
  }
  const filters = [
    { label: "Division", value: division, update: setDivision, options: divisions.map(value => [value, value]) },
    { label: "Brand", value: brand, update: setBrand, options: brands.map(value => [value, value]) },
    { label: "Severity", value: severity, update: setSeverity, options: [["blocked", "Blocking issue"], ["improve", "Improve"], ["review", "Human review"]] },
    { label: "Rule", value: rule, update: setRule, options: report?.rules.map(item => [item.code, `${humanRule(item.code)} (${item.count})`]) || [] },
    { label: "Visibility", value: visibility, update: setVisibility, options: [["active", "Active"], ["inactive", "Inactive"]], all: "all" },
    { label: "Readiness", value: status, update: setStatus, options: [["blocked", "Blocked"], ["needs-improvement", "Needs improvement / review"], ["ready", "Automated checks passed"]] },
    { label: "Review area", value: area, update: setArea, options: QUALITY_AREAS.map(item => [item.id, item.label]) },
  ]

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Catalogue standards</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Catalogue quality</h1><p className="mt-2 max-w-3xl text-sm text-gray-600">See what is missing, invalid or inconsistent for each product, with reasons and suggested next actions. This dashboard reports issues and never saves corrections.</p></div><button type="button" onClick={scan} disabled={scanning} className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}{scanning ? "Scanning clone…" : report ? "Run new scan" : "Scan verified clone"}</button></div>
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>Scans use only the verified <strong>sara_clone</strong> database. Production products are not read or modified by this dashboard. <Link href="/admin/database-clone" className="font-semibold underline">Create or check the manual clone</Link>.</p></div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!report && !scanning && <section className="rounded-xl border bg-white p-8"><h2 className="text-lg font-bold">Start with a measured baseline</h2><p className="mt-2 text-sm text-gray-600">The scan checks product identity, merchandising hierarchy, descriptions, identifiers, images, pricing, stock, warranty, tax fields and page/feed consistency. Missing or contradictory facts are reported for review. No product updates are performed.</p><p className="mt-3 text-sm text-gray-600">Create and verify the clone first. Then run a scan when needed; no scheduled scans or paid service are added.</p></section>}
    {scanning && <div role="status" className="flex items-center gap-3 rounded-xl border bg-white p-8 text-sm"><Loader2 className="h-5 w-5 animate-spin text-blue-700" />Reading the cloned catalogue and checking product rules. No database writes are performed.</div>}
    {report && <>
      <p className="text-xs text-gray-600">Environment: <strong>{report.environment}</strong> · Scanned {new Date(report.scannedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST{report.cloneCompletedAt && <> · Clone verified {new Date(report.cloneCompletedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</>}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Products scanned", report.total, "text-gray-900"], ["Active products", report.active, "text-gray-900"], ["Blocked", report.blocked, "text-red-800"], ["Needs improvement / review", report.needsImprovement, "text-amber-800"], ["Automated checks passed", report.ready, "text-green-800"]].map(([label, value, color]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs font-medium text-gray-500">{label}</p><p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p></div>)}</div>
      <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-gray-800">Scope and verification limitations</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">{report.limitations.map(item => <li key={item}>{item}</li>)}</ul></details>
      <CatalogueReviewOverview report={report} onFocus={focusReview} />
      <section id="product-review" className="scroll-mt-6 rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Product review queue</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={() => exportReport()} disabled={!products.some(product => visibleIssues(product).length)} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"><Download className="h-4 w-4" />Export filtered issues</button><button type="button" onClick={() => exportReport(true)} disabled={!products.some(product => visibleIssues(product).length)} className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" />Review worksheet</button></div></div>
        <p className="mt-2 text-xs text-gray-500">Exports include all matching issues across every page. The worksheet adds blank proposal, evidence and approval columns for review; it never applies changes.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="relative block"><span className="mb-1 block text-xs font-medium text-gray-600">Search products</span><Search className="absolute bottom-3 left-3 h-4 w-4 text-gray-400" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Name, SKU or brand" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" /></label>{filters.map(filter => <label key={filter.label} className="block text-xs font-medium text-gray-600">{filter.label}<select value={filter.value} onChange={event => { filter.update(event.target.value); setPage(1) }} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-800"><option value={filter.all || ""}>All {filter.label.toLowerCase()}</option>{filter.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-gray-600">{products.length.toLocaleString("en-IN")} matching products · {products.reduce((sum, product) => sum + visibleIssues(product).length, 0).toLocaleString("en-IN")} matching issues</p><div className="flex items-center gap-3"><label className="text-xs text-gray-600">Sort <select value={sort} onChange={event => { setSort(event.target.value as ReviewSort); setPage(1) }} className="ml-1 rounded-lg border bg-white px-3 py-2 text-sm"><option value="priority">Review priority</option><option value="issues">Most matching issues</option><option value="name">Product name</option></select></label><button type="button" onClick={() => focusReview({}, false)} className="text-sm font-semibold text-blue-800 underline">Clear filters</button></div></div>
        <div className="mt-4 space-y-3">{products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(product => <details key={product.id} className="rounded-lg border"><summary className="cursor-pointer rounded-lg p-4"><span className="font-semibold text-gray-900">{product.name}</span><span className="ml-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{product.active ? "Active" : "Inactive"}</span><span className="mt-1 block text-xs text-gray-500">{product.sku || "Missing SKU"} · {[product.division, product.category, product.segment, product.brand].filter(Boolean).join(" / ") || "Unclassified"}</span><span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${product.status === "blocked" ? "bg-red-50 text-red-800" : product.status === "ready" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>{product.status === "ready" ? "Automated checks passed" : `${visibleIssues(product).length} matching issues — ${product.status.replace(/-/g, " ")}`}</span></summary>
          <div className="space-y-3 border-t p-4"><p className="text-xs font-semibold text-gray-600">{reviewPriority(product)}</p>{visibleIssues(product).map(issue => <article key={issue.code} className={`rounded-lg border p-4 ${severityClass[issue.severity]}`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{issue.field}: {humanRule(issue.code)}</h3><span className="text-xs font-semibold">{severityLabel[issue.severity]}</span></div><p className="mt-2 break-words text-xs"><strong>Current:</strong> {issue.current}</p><p className="mt-2 text-sm">{issue.reason}</p><p className="mt-2 text-sm"><strong>Suggested action:</strong> {issue.action}</p></article>)}{!product.issues.length && <p className="text-sm text-gray-600">No issues found by these automated rules. Manufacturer facts, photos and policy details still require human verification.</p>}</div>
        </details>)}</div>
        {!products.length && <p className="py-12 text-center text-sm text-gray-500">No products match these filters.</p>}
        <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm"><p>Page {currentPage} of {totalPages}</p><div className="flex gap-2"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="rounded-lg border px-3 py-2 disabled:opacity-50">Previous</button><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="rounded-lg border px-3 py-2 disabled:opacity-50">Next</button></div></div>
      </section>
    </>}
  </div>
}
