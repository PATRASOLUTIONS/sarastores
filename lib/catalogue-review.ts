import { qualityCsvCell, type QualityIssue, type QualityProduct, type QualitySeverity } from "@/lib/catalogue-quality"

export const QUALITY_AREAS = [
  { id: "identity", label: "SKU, model and barcodes", guidance: "Itemno is your SKU. Manufacturer model numbers and barcodes are checked separately." },
  { id: "taxonomy", label: "Classification", guidance: "Agree consistent division, category, segment and brand labels." },
  { id: "content", label: "Product content", guidance: "Use official specifications and descriptions for the exact model and variant." },
  { id: "images", label: "Product images", guidance: "Confirm the main image and useful views show the exact item and variant." },
  { id: "commercial", label: "Price and inventory", guidance: "Reconcile selling prices, printed MRP and stock with the commercial team." },
  { id: "compliance", label: "Warranty and tax", guidance: "Get warranty, HSN and GST evidence from the responsible team." },
] as const

export type QualityArea = typeof QUALITY_AREAS[number]["id"]
export type ReviewSort = "priority" | "issues" | "name"
export interface ReviewFilters {
  search: string; division: string; brand: string; severity: string; rule: string
  visibility: string; status: string; area: string; sort: ReviewSort
}
export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  search: "", division: "", brand: "", severity: "", rule: "", visibility: "all", status: "", area: "", sort: "priority",
}

export function issueArea(issue: QualityIssue): QualityArea {
  if (/image/.test(issue.code)) return "images"
  if (/price|mrp|stock|weight/.test(issue.code)) return "commercial"
  if (/warranty|hsn|gst/.test(issue.code)) return "compliance"
  if (/division|category|segment|brand/.test(issue.code)) return "taxonomy"
  if (/description|specification|slug/.test(issue.code) && issue.code !== "duplicate-slug") return "content"
  return "identity"
}

export function matchingReviewIssues(product: QualityProduct, filters: ReviewFilters): QualityIssue[] {
  return product.issues.filter(issue => (!filters.severity || issue.severity === filters.severity) &&
    (!filters.rule || issue.code === filters.rule) && (!filters.area || issueArea(issue) === filters.area))
}

/** Priority is triage order, not a product quality or sales score. */
export function reviewPriority(product: QualityProduct): string {
  if (product.status === "blocked") return product.active ? "P1 — Active product blocked" : "P2 — Resolve before activation"
  if (product.issues.length) return product.active ? "P3 — Improve active product" : "P4 — Prepare inactive product"
  return "P5 — Automated checks passed"
}

const priorityRank = (product: QualityProduct) => product.status === "blocked" ? (product.active ? 0 : 1) : product.issues.length ? (product.active ? 2 : 3) : 4

export function filterReviewProducts(products: QualityProduct[], filters: ReviewFilters): QualityProduct[] {
  const term = filters.search.trim().toLowerCase()
  const filtered = products.filter(product =>
    (!term || [product.id, product.sku, product.name, product.division, product.category, product.segment, product.brand].join(" ").toLowerCase().includes(term)) &&
    (!filters.division || product.division === filters.division) && (!filters.brand || product.brand === filters.brand) &&
    (filters.visibility === "all" || product.active === (filters.visibility === "active")) &&
    (!filters.status || product.status === filters.status) &&
    ((!filters.severity && !filters.rule && !filters.area) || matchingReviewIssues(product, filters).length > 0))
  return filtered.sort((a, b) => {
    if (filters.sort === "priority") {
      const rank = priorityRank(a) - priorityRank(b)
      if (rank) return rank
    }
    if (filters.sort !== "name") {
      const count = matchingReviewIssues(b, filters).length - matchingReviewIssues(a, filters).length
      if (count) return count
    }
    return a.name.localeCompare(b.name, "en", { numeric: true }) || a.id.localeCompare(b.id)
  })
}

export function catalogueReviewSummary(products: QualityProduct[]) {
  const areas = QUALITY_AREAS.map(area => {
    const affected = products.filter(product => product.issues.some(issue => issueArea(issue) === area.id))
    return { ...area, products: affected.length,
      activeBlocked: affected.filter(product => product.active && product.issues.some(issue => issueArea(issue) === area.id && issue.severity === "blocked")).length,
      issues: affected.reduce((count, product) => count + product.issues.filter(issue => issueArea(issue) === area.id).length, 0) }
  })
  const divisions = new Map<string, { division: string; total: number; active: number; activeBlocked: number; blocked: number; ready: number }>()
  const rules = new Map<string, { code: string; severity: QualitySeverity; products: number; active: number }>()
  for (const product of products) {
    const row = divisions.get(product.division) || { division: product.division, total: 0, active: 0, activeBlocked: 0, blocked: 0, ready: 0 }
    row.total++; row.active += Number(product.active)
    row.blocked += Number(product.status === "blocked")
    row.activeBlocked += Number(product.active && product.status === "blocked")
    row.ready += Number(product.status === "ready"); divisions.set(product.division, row)
    for (const code of new Set(product.issues.map(issue => issue.code))) {
      const issue = product.issues.find(item => item.code === code)!
      const rule = rules.get(code) || { code, severity: issue.severity, products: 0, active: 0 }
      rule.products++; rule.active += Number(product.active); rules.set(code, rule)
    }
  }
  const severityOrder = { blocked: 0, improve: 1, review: 2 }
  return { areas, activeBlocked: products.filter(product => product.active && product.status === "blocked").length,
    divisions: [...divisions.values()].sort((a, b) => b.activeBlocked - a.activeBlocked || b.blocked - a.blocked || a.division.localeCompare(b.division)),
    rules: [...rules.values()].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.active - a.active || b.products - a.products || a.code.localeCompare(b.code)) }
}

/** A review document, with blank proposals and approval cells; never an import payload. */
export function catalogueReviewCsv(products: QualityProduct[], filters: ReviewFilters, environment: string, scannedAt: string, worksheet = false): string {
  const columns = ["Catalogue database", "Scan time", "Priority", "Product ID", "SKU", "Product", "Active", "Division", "Category", "Segment", "Brand", "Status", "Area", "Rule", "Field", "Severity", "Current value", "Why it matters", "Suggested action"]
  if (worksheet) columns.push("Proposed value (review only)", "Evidence / official source", "Reviewer", "Approval decision (not applied)")
  const rows = products.flatMap(product => matchingReviewIssues(product, filters).map(issue => {
    const row: unknown[] = [environment, scannedAt, reviewPriority(product), product.id, product.sku, product.name, product.active,
      product.division, product.category, product.segment, product.brand, product.status, issueArea(issue), issue.code, issue.field, issue.severity, issue.current, issue.reason, issue.action]
    if (worksheet) row.push("", "", "", "")
    return row
  }))
  return "\uFEFF" + [columns, ...rows].map(row => row.map(qualityCsvCell).join(",")).join("\r\n")
}
