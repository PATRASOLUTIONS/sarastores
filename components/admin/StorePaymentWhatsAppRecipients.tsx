"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetchJson } from "@/lib/api-client"
import {
  StorePaymentWhatsAppAdminSchema, StorePaymentWhatsAppSettingsSchema, WhatsAppNumberSchema,
  type StorePaymentWhatsAppSettings,
} from "@/types/store-payment"

type AdminStore = { id: string; name: string; city: string; listedPhone: string }

/** Edits who gets the pay-at-store WhatsApp: each store's manager and the platform managers. */
export default function StorePaymentWhatsAppRecipients({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<StorePaymentWhatsAppSettings>({ notifyStoreManager: true, storeManagers: {}, platformManagers: [] })
  const [stores, setStores] = useState<AdminStore[]>([])
  const [configuration, setConfiguration] = useState<{ whatsapp: boolean; email: boolean; missing: string[] } | null>(null)
  const [draft, setDraft] = useState({ name: "", phone: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    apiFetchJson("/api/admin/store-payment-whatsapp", undefined, value => StorePaymentWhatsAppAdminSchema.parse(value))
      .then(data => {
        if (!active) return
        setSettings(data.settings)
        setStores(data.stores)
        setConfiguration(data.configuration || null)
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Failed to load recipients") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const setStoreManager = (storeId: string, phone: string) => setSettings(current => {
    const storeManagers = { ...current.storeManagers }
    if (phone.trim()) storeManagers[storeId] = phone
    else delete storeManagers[storeId]
    return { ...current, storeManagers }
  })

  const addManager = () => {
    const phone = WhatsAppNumberSchema.safeParse(draft.phone)
    if (!draft.name.trim()) { toast.error("Enter the manager's name"); return }
    if (!phone.success) { toast.error(phone.error.issues[0]?.message || "Invalid number"); return }
    if (settings.platformManagers.some(manager => manager.phone === phone.data)) { toast.error("That number is already on the list"); return }
    setSettings(current => ({ ...current, platformManagers: [...current.platformManagers, { name: draft.name.trim(), phone: phone.data }] }))
    setDraft({ name: "", phone: "" })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = await apiFetchJson("/api/admin/store-payment-whatsapp", { method: "PUT", json: settings },
        value => StorePaymentWhatsAppSettingsSchema.parse(value))
      setSettings(saved)
      toast.success("WhatsApp recipients saved")
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save recipients")
    } finally { setSaving(false) }
  }

  const disabled = loading || saving || !!error

  return <form onSubmit={save} className="space-y-5">
    {error ? <p role="alert" className="text-sm text-red-700">{error} Only full administrators can change these recipients.</p> : null}
    {!loading && !error && configuration && <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <h4 className="font-semibold text-slate-900">Notification configuration</h4>
      <p className="mt-1">WhatsApp provider: {configuration.whatsapp ? "configured" : "not configured"}. Store email fallback: {configuration.email ? "configured" : "not configured"}.</p>
      {configuration.missing.length > 0 && <>
        <p className="mt-2 font-semibold text-amber-800">Set the missing server variables before expecting these messages:</p>
        <ul className="mt-1 list-disc pl-4">{configuration.missing.map(name => <li key={name}><code>{name}</code></li>)}</ul>
      </>}
      <p className="mt-2">Configured credentials still need provider acceptance; this screen does not send a test message.</p>
    </section>}

    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-900">Store managers</h4>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={settings.notifyStoreManager} disabled={disabled}
          onChange={event => setSettings(current => ({ ...current, notifyStoreManager: event.target.checked }))} />
        Message the manager of the store the customer selected
      </label>
      <p className="text-xs text-gray-500">Leave a number blank to use the mobile number listed on the store.</p>
      <div className="max-h-64 overflow-y-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr><th className="p-2">Store</th><th className="p-2">Listed mobile</th><th className="p-2">Manager WhatsApp</th></tr>
          </thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={3} className="p-3 text-gray-500">Loading…</td></tr>
              : stores.length === 0 ? <tr><td colSpan={3} className="p-3 text-gray-500">No active stores.</td></tr>
                : stores.map(store => (
                  <tr key={store.id}>
                    <td className="p-2"><div className="font-medium">{store.name}</div><div className="text-xs text-gray-500">{store.city}</div></td>
                    <td className="p-2 text-gray-600">{store.listedPhone || <span className="text-red-600">none</span>}</td>
                    <td className="p-2">
                      <input type="tel" inputMode="numeric" maxLength={16} disabled={disabled || !settings.notifyStoreManager}
                        aria-label={`Manager WhatsApp for ${store.name}`} placeholder={store.listedPhone || "10-digit number"}
                        value={settings.storeManagers[store.id] ?? ""} onChange={event => setStoreManager(store.id, event.target.value)}
                        className="w-36 rounded border p-1.5 text-sm" />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </section>

    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-900">Platform managers</h4>
      <p className="text-xs text-gray-500">These numbers get every pay-at-store order, whichever store is chosen.</p>
      <ul className="divide-y rounded-lg border">
        {settings.platformManagers.length === 0 ? <li className="p-3 text-sm text-gray-500">No platform managers yet.</li>
          : settings.platformManagers.map(manager => (
            <li key={manager.phone} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="truncate">{manager.name} <span className="text-gray-500">· {manager.phone}</span></span>
              <button type="button" disabled={disabled} aria-label={`Remove ${manager.name}`}
                onClick={() => setSettings(current => ({ ...current, platformManagers: current.platformManagers.filter(item => item.phone !== manager.phone) }))}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input type="text" maxLength={80} value={draft.name} disabled={disabled} placeholder="Name" aria-label="Platform manager name"
          onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
          className="min-w-0 flex-1 rounded-lg border p-2.5 text-sm" />
        <input type="tel" inputMode="numeric" maxLength={16} value={draft.phone} disabled={disabled} placeholder="WhatsApp number" aria-label="Platform manager WhatsApp number"
          onChange={event => setDraft(current => ({ ...current, phone: event.target.value }))}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addManager() } }}
          className="min-w-0 flex-1 rounded-lg border p-2.5 text-sm" />
        <button type="button" onClick={addManager} disabled={disabled || !draft.phone.trim()}
          className="inline-flex items-center gap-1 rounded-lg border px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          <Plus className="h-4 w-4" />Add
        </button>
      </div>
    </section>

    <p className="text-xs text-gray-600">The message carries the order items, offers applied, customer name, phone, email and delivery address, and the amount to collect, so the store can send a payment link from WhatsApp.</p>
    <button type="submit" disabled={disabled} className="rounded-lg bg-primary px-5 py-2.5 text-sm text-white disabled:opacity-50">
      {loading ? "Loading..." : saving ? "Saving..." : "Save recipients"}
    </button>
  </form>
}
