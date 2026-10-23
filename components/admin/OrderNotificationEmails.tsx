"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetchJson } from "@/lib/api-client"
import { OrderNotificationSettingsSchema } from "@/lib/validation"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Edits who receives the "order confirmed" email. The first address is the primary recipient. */
export default function OrderNotificationEmails({ onSaved }: { onSaved?: () => void }) {
  const [emails, setEmails] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    apiFetchJson("/api/admin/order-notifications", undefined, value => OrderNotificationSettingsSchema.parse(value))
      .then(settings => {
        if (!active) return
        setEmails([settings.email, ...settings.additionalEmails].filter(Boolean))
        setEnabled(settings.enabled)
        setError("")
      })
      .catch(error => {
        if (active) setError(error instanceof Error ? error.message : "Failed to load settings")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const addDraft = () => {
    const email = draft.trim().toLowerCase()
    if (!email) return
    if (!EMAIL.test(email)) { toast.error("Enter a valid email address"); return }
    if (emails.includes(email)) { toast.error("That email is already on the list"); return }
    if (emails.length >= 11) { toast.error("You can add up to 11 recipients"); return }
    setEmails(list => [...list, email])
    setDraft("")
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const pending = draft.trim().toLowerCase()
    const list = pending && EMAIL.test(pending) && !emails.includes(pending) ? [...emails, pending] : emails
    if (enabled && !list.length) { toast.error("Add at least one email before enabling"); return }
    setSaving(true)
    try {
      const settings = await apiFetchJson("/api/admin/order-notifications", {
        method: "PUT", json: { enabled, email: list[0] ?? "", additionalEmails: list.slice(1) },
      }, value => OrderNotificationSettingsSchema.parse(value))
      setEmails([settings.email, ...settings.additionalEmails].filter(Boolean))
      setEnabled(settings.enabled)
      setDraft("")
      toast.success("Order confirmation recipients saved")
      onSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    } finally { setSaving(false) }
  }

  const disabled = loading || saving || !!error

  return <form onSubmit={save} className="space-y-4">
    {error ? <p role="alert" className="text-sm text-red-700">{error} Only full administrators can change these recipients.</p> : null}
    <label className="flex items-center gap-3 text-sm">
      <input type="checkbox" checked={enabled} disabled={disabled} onChange={event => setEnabled(event.target.checked)} />
      Send an email to these addresses when an order is confirmed
    </label>
    <ul className="divide-y rounded-lg border">
      {loading ? <li className="p-3 text-sm text-gray-500">Loading…</li>
        : emails.length === 0 ? <li className="p-3 text-sm text-gray-500">No recipients yet.</li>
          : emails.map((email, index) => (
            <li key={email} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="truncate">{email}{index === 0 && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Primary</span>}</span>
              <button type="button" disabled={disabled} onClick={() => setEmails(list => list.filter(item => item !== email))}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" aria-label={`Remove ${email}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
    </ul>
    <div className="flex gap-2">
      <label htmlFor="notification-email" className="sr-only">Add recipient email</label>
      <input id="notification-email" type="email" maxLength={255} value={draft} disabled={disabled} placeholder="name@business.com"
        onChange={event => setDraft(event.target.value)} autoComplete="email"
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addDraft() } }}
        className="min-w-0 flex-1 rounded-lg border p-2.5 text-sm" />
      <button type="button" onClick={addDraft} disabled={disabled || !draft.trim()}
        className="inline-flex items-center gap-1 rounded-lg border px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
        <Plus className="h-4 w-4" />Add
      </button>
    </div>
    <p className="text-xs text-gray-600">Emails contain only the order number and total, never customer addresses, payment secrets or license keys. Changes apply to future confirmations only.</p>
    <button type="submit" disabled={disabled} className="rounded-lg bg-primary px-5 py-2.5 text-sm text-white disabled:opacity-50">
      {loading ? "Loading..." : saving ? "Saving..." : "Save recipients"}
    </button>
  </form>
}
