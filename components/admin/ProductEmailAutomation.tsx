"use client"

import { useState } from "react"
import { Mail, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"

type Delivery = { id: string; recipient: string; date: string; status: string }
type State = { settings: { enabled: boolean; recipients: string[] }; smtp: { ready: boolean; error: string }; deliveries: Delivery[] }
const ENDPOINT = "/api/admin/product-email-automation"

export default function ProductEmailAutomation() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<State | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [emails, setEmails] = useState("")
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setBusy(true)
    setError("")
    try {
      const response = await apiFetch(ENDPOINT)
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || "Could not load email settings")
      setData(value)
      setEnabled(value.settings.enabled)
      setEmails(value.settings.recipients.join("\n"))
      setDirty(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load email settings") }
    finally { setBusy(false) }
  }

  async function save() {
    setBusy(true)
    try {
      const recipients = emails.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean)
      const response = await apiFetch(ENDPOINT, { method: "PUT", body: JSON.stringify({ enabled, recipients }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || "Could not save email settings")
      toast.success("Daily email settings saved")
      await load()
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not save email settings") }
    finally { setBusy(false) }
  }

  async function send() {
    setBusy(true)
    try {
      const response = await apiFetch(ENDPOINT, { method: "POST" })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || "Could not send email")
      if (value.failed || value.unknown) toast.error("Some emails failed or need delivery review. Check the status below.")
      else if (value.accepted) toast.success(`${value.accepted} email(s) accepted by the mail server`)
      else toast("No new emails sent. Today's email was already attempted or no recipients are saved.")
      await load()
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not send email") }
    finally { setBusy(false) }
  }

  return <>
    <button type="button" onClick={() => { setOpen(true); void load() }}
      className="flex w-full min-w-[8rem] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
      <Mail className="mr-2 h-4 w-4" />Daily Email
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="product-email-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="product-email-title" className="text-xl font-semibold">Daily price and stock email</h2>
          <button type="button" aria-label="Close daily email settings" onClick={() => setOpen(false)} className="rounded p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-gray-600">Every day at 11:30 AM India time, send a reminder with the active products price Excel and the Stock Check template Excel attached.</p>
        {error && <div className="mb-4 text-sm text-red-700">{error} <button type="button" onClick={() => void load()} className="underline">Retry</button></div>}
        {!data && busy && <p className="text-sm text-gray-500">Loading email settings...</p>}
        {data && <>
          {!data.smtp.ready && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{data.smtp.error}</p>}
          <label className="mb-4 flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={enabled} disabled={busy} onChange={event => { setEnabled(event.target.checked); setDirty(true) }} />Enable daily emails
          </label>
          <label htmlFor="product-email-recipients" className="mb-1 block text-sm font-medium">Recipient email addresses</label>
          <textarea id="product-email-recipients" rows={4} value={emails} disabled={busy} onChange={event => { setEmails(event.target.value); setDirty(true) }}
            placeholder="name@example.com" className="w-full rounded-lg border border-gray-300 p-3 text-sm" />
          <p className="mt-1 text-xs text-gray-500">Add one email per line, up to 10 recipients. Each recipient gets a separate email.</p>
          <div className="my-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Please wait..." : "Save settings"}</button>
            <button type="button" onClick={() => void send()} disabled={busy || dirty || !data.smtp.ready || !data.settings.recipients.length}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">Send today&apos;s email now</button>
          </div>
          {dirty && <p className="mb-3 text-xs text-gray-500">Save changes before sending.</p>}
          <h3 className="mb-2 text-sm font-semibold">Recent delivery status</h3>
          <p className="mb-3 text-xs text-gray-500">Accepted means the mail server accepted the email. Emails are attempted once per recipient each day. Unknown means delivery needs review; it will not be resent automatically.</p>
          {!data.deliveries.length ? <p className="text-sm text-gray-500">No emails have been sent yet.</p> : <ul className="space-y-2 text-sm">
            {data.deliveries.map(delivery => <li key={delivery.id} className="flex flex-wrap justify-between gap-2 rounded border border-gray-100 p-2">
              <span className="break-all">{delivery.recipient}<span className="ml-2 text-xs text-gray-500">{delivery.date}</span></span>
              <span className={delivery.status === "accepted" ? "text-green-700" : delivery.status === "failed" || delivery.status === "unknown" ? "text-red-700" : "text-gray-600"}>{delivery.status}</span>
            </li>)}
          </ul>}
        </>}
      </section>
    </div>}
  </>
}
