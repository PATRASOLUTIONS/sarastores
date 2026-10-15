"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { apiFetchJson } from "@/lib/api-client"
import { OrderNotificationSettingsSchema } from "@/lib/validation"

export default function NotificationSettings() {
  const [email, setEmail] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    apiFetchJson("/api/admin/order-notifications", undefined, value => OrderNotificationSettingsSchema.parse(value))
      .then(settings => {
        if (active) { setEmail(settings.email); setEnabled(settings.enabled); setError("") }
      })
      .catch(error => {
        if (active) { setError(error instanceof Error ? error.message : "Failed to load settings"); toast.error("Failed to load notification settings") }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const settings = await apiFetchJson("/api/admin/order-notifications", {
        method: "PUT", json: { enabled, email: email.trim() },
      }, value => OrderNotificationSettingsSchema.parse(value))
      setEmail(settings.email)
      setEnabled(settings.enabled)
      toast.success("Order notification settings saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    } finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-2xl space-y-6">
    <Link href="/admin/orders" className="text-primary underline">Admin / Orders</Link>
    <h1 className="text-2xl font-bold">Order notifications</h1>
    <p className="text-gray-600">Send an additional email when an order is confirmed by a verified payment or an administrator. Customer emails continue; staff copies respect store permissions.</p>
    {error ? <p role="alert" className="text-red-700">{error} Reload this page before editing.</p> : null}
    <form onSubmit={save} className="space-y-5 rounded-xl border bg-white p-6">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={enabled} disabled={loading || saving || !!error} onChange={event => setEnabled(event.target.checked)} />
        Enable confirmed-order emails
      </label>
      <div>
        <label htmlFor="notification-email" className="mb-2 block font-medium">Recipient email address</label>
        <input id="notification-email" type="email" maxLength={255} value={email} required={enabled}
          disabled={loading || saving || !!error} onChange={event => setEmail(event.target.value)}
          className="w-full rounded-lg border p-3" autoComplete="email" />
      </div>
      <p className="text-sm text-gray-600">Use an authorised business inbox. Emails contain only the order number and total, never customer addresses, payment secrets or license keys. SMTP must be configured; saving does not test delivery. Changes apply to future confirmations only.</p>
      <button type="submit" disabled={loading || saving || !!error} className="rounded-lg bg-primary px-5 py-3 text-white disabled:opacity-50">
        {loading ? "Loading..." : saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  </div>
}
