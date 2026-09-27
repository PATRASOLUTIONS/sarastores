"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Facet, FacetSelection } from "@/lib/product-facets"

/**
 * Spec facet groups for the listing sidebar.
 *
 * Facets are derived from the current result set, so this renders whatever is
 * actually filterable for the category being viewed — screen size on TVs, load
 * type on washing machines — without any per-category configuration.
 */
export default function SpecFacets({
  facets,
  selection,
  onToggle,
}: {
  facets: Facet[]
  selection: FacetSelection
  onToggle: (key: string, value: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (facets.length === 0) return null

  return (
    <>
      {facets.map((facet) => {
        const isOpen = !collapsed[facet.key]
        const selected = selection[facet.key] || []

        return (
          <div key={facet.key}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">{facet.label}</h3>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [facet.key]: isOpen }))}
                className="rounded-md p-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${facet.label} filter`}
                aria-expanded={isOpen}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </button>
            </div>

            {isOpen && (
              <div className="max-h-48 space-y-2 overflow-y-auto pr-2">
                {facet.values.map(({ value, count }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(value)}
                      onChange={() => onToggle(facet.key, value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 text-sm text-gray-700">{value}</span>
                    <span className="text-xs tabular-nums text-gray-400">{count}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
