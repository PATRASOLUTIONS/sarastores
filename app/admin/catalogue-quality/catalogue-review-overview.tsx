"use client"

import { useMemo } from "react"
import { ArrowRight } from "lucide-react"
import { catalogueReviewSummary, type ReviewFilters } from "@/lib/catalogue-review"
import type { QualityReport } from "@/lib/catalogue-quality"

export default function CatalogueReviewOverview({ report, onFocus }: {
  report: QualityReport; onFocus: (filters: Partial<ReviewFilters>) => void
}) {
  const summary = useMemo(() => catalogueReviewSummary(report.products), [report.products])
  return <section className="space-y-5" aria-label="Catalogue review priorities">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5">
      <div><h2 className="font-bold text-gray-900">Start with active products that have blocking issues</h2>
        <p className="mt-1 text-sm text-gray-700"><strong>{summary.activeBlocked.toLocaleString("en-IN")}</strong> active products need a blocking issue reviewed. Then prepare blocked inactive products before activation.</p>
        <p className="mt-2 text-xs text-gray-600">Priority guides the review order. It does not change product visibility, prices or shopping-channel approval.</p></div>
      <button type="button" onClick={() => onFocus({ visibility: "active", status: "blocked" })} disabled={!summary.activeBlocked}
        className="inline-flex items-center gap-2 rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Review first <ArrowRight className="h-4 w-4" /></button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{summary.areas.map(area => <button key={area.id} type="button" onClick={() => onFocus({ area: area.id })}
      className="rounded-xl border bg-white p-5 text-left transition hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
      <span className="block text-sm font-bold text-gray-900">{area.label}</span>
      <span className="mt-2 block text-2xl font-bold text-blue-950">{area.products.toLocaleString("en-IN")} <span className="text-xs font-normal text-gray-500">products with issues</span></span>
      <span className="mt-1 block text-xs text-gray-600">{area.issues.toLocaleString("en-IN")} issues · {area.activeBlocked.toLocaleString("en-IN")} active products blocked in this area</span>
      <span className="mt-3 block text-xs leading-relaxed text-gray-600">{area.guidance}</span>
    </button>)}</div>
    <p className="text-xs text-gray-500">A product can have issues in several areas; area totals overlap. These summaries cover the full scan.</p>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-5"><h2 className="font-bold text-gray-900">Review by division</h2><p className="mt-1 text-xs text-gray-500">Sorted by active products with blocking issues. Click a division to review all its products.</p></div>
        <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-gray-50 text-xs text-gray-600"><tr><th scope="col" className="p-3">Division</th><th scope="col" className="p-3 text-right">Products</th><th scope="col" className="p-3 text-right">Active blocked</th><th scope="col" className="p-3 text-right">Checks passed</th></tr></thead>
          <tbody>{summary.divisions.map(row => <tr key={row.division} className="border-t"><th scope="row" className="p-3 font-medium"><button type="button" className="text-left text-blue-800 underline underline-offset-2" onClick={() => onFocus(row.division ? { division: row.division } : { rule: "missing-division" })}>{row.division || "Unclassified (missing division)"}</button></th><td className="p-3 text-right">{row.total}</td><td className="p-3 text-right font-semibold text-red-800">{row.activeBlocked}</td><td className="p-3 text-right text-green-800">{row.ready}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-bold text-gray-900">Highest-priority issues</h2><p className="mt-1 text-xs text-gray-500">Blocking rules first, then the number of active products affected.</p>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto">{summary.rules.slice(0, 12).map(rule => <button type="button" key={rule.code} onClick={() => onFocus({ rule: rule.code })} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:border-blue-400">
          <span><span className="block text-sm font-semibold capitalize text-gray-800">{rule.code.replace(/-/g, " ")}</span><span className="block text-xs text-gray-500">{rule.severity === "blocked" ? "Blocking issue" : rule.severity === "review" ? "Human review" : "Improve"} · {rule.active} active products</span></span><span className="shrink-0 text-sm font-bold text-blue-950">{rule.products} products</span>
        </button>)}{!summary.rules.length && <p className="py-6 text-sm text-gray-600">No automated issues found. Verify manufacturer facts, imagery and commercial details before publishing to new channels.</p>}</div>
      </section>
    </div>
    <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-bold text-gray-900">How to prepare corrections for approval</summary>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-600">
        <li>Choose a division or issue and review the exact products affected.</li>
        <li>Download the review worksheet and enter proposed values with official manufacturer, inventory or commercial evidence.</li>
        <li>Review duplicates and URL changes together so identifiers and product references remain consistent.</li>
        <li>Submit the completed worksheet for approval. Database implementation needs a separate reviewed change preview; this page has no apply action.</li>
        <li>After approved changes are implemented, verify the storefront, product feed and stock behaviour against the reviewed values.</li>
      </ol><p className="mt-3 text-xs text-gray-500">The worksheet is a local review document. It is not uploaded, imported or saved by this dashboard.</p>
    </details>
  </section>
}
