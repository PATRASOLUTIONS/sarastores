"use client"

import { useState } from "react"
import { Check, Loader2, Plus, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"

export type TaxonomyList = "brands" | "categories" | "subCategories" | "charDescs"

interface Props {
  label: string
  list: TaxonomyList
  value: string
  options: string[]
  required?: boolean
  onChange: (value: string) => void
  /** Called after a new option is stored so the parent can refresh its list. */
  onAdded?: (value: string) => void
}

/**
 * A classification dropdown that can create its own options.
 *
 * Data entry stalls when the right category does not exist yet, so the operator
 * can add one inline rather than leaving the page and losing the scrape.
 */
export default function SelectWithAdd({
  label,
  list,
  value,
  options,
  required,
  onChange,
  onAdded,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  // A scraped value that is not in the list yet must still show as selected.
  const merged = value && !options.includes(value) ? [value, ...options] : options

  const submit = async () => {
    const clean = draft.trim()
    if (!clean) return
    setSaving(true)
    try {
      const res = await apiFetch("/api/admin/taxonomy", { method: "POST", json: { list, value: clean } })
      const body = await res.json()
      if (!res.ok || !body?.success) {
        toast.error(body?.error || "Could not add")
        return
      }
      onChange(body.value)
      onAdded?.(body.value)
      setAdding(false)
      setDraft("")
      toast.success(body.stored ? `Added “${body.value}”` : `Using existing “${body.value}”`)
    } catch {
      toast.error("Could not add")
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="block text-xs font-semibold text-gray-700">
      {label}
      {required && <span className="text-red-500"> *</span>}

      {adding ? (
        <div className="mt-1 flex gap-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submit()
              }
              if (e.key === "Escape") setAdding(false)
            }}
            placeholder={`New ${label.toLowerCase()}`}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal"
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving || !draft.trim()}
            title="Save"
            className="shrink-0 rounded-lg bg-gray-900 px-2 text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            title="Cancel"
            className="shrink-0 rounded-lg border border-gray-300 px-2 text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-1 flex gap-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal"
          >
            <option value="">— Select —</option>
            {merged.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setDraft(value && !options.includes(value) ? value : "")
              setAdding(true)
            }}
            title={`Add a new ${label.toLowerCase()}`}
            className="shrink-0 rounded-lg border border-gray-300 px-2 text-gray-600 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {value && !options.includes(value) && !adding && (
        <span className="mt-1 block text-[11px] font-normal text-amber-700">
          “{value}” is not in the list yet — press + to add it.
        </span>
      )}
    </label>
  )
}
