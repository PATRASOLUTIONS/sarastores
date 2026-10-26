"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { apiFetchJson } from "@/lib/api-client"
import { CreateGiftSchema, GiftListSchema, type Gift } from "@/lib/gift-validation"
import { useSubmitLock } from "@/hooks/useSubmitLock"

const empty = { sku: "", name: "", photo: "", price: 0, mrp: 0, active: true }

export default function GiftsAdminPage() {
  const [gifts, setGifts] = useState<Gift[]>([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [readingPhoto, setReadingPhoto] = useState(false)
  const lock = useSubmitLock()
  const load = async () => {
    setLoading(true); setError("")
    try { setGifts((await apiFetchJson("/api/admin/gifts", {}, value => GiftListSchema.parse(value))).gifts) }
    catch (error) { setError(error instanceof Error ? error.message : "Could not load gifts") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const save = async () => {
    const parsed = CreateGiftSchema.safeParse(form)
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }
    if (readingPhoto || !lock.acquire()) return
    setSaving(true)
    try {
      await apiFetchJson(editing ? `/api/admin/gifts/${encodeURIComponent(editing)}` : "/api/admin/gifts", { method: editing ? "PUT" : "POST", json: parsed.data })
      toast.success(editing ? "Gift updated" : "Gift added"); setEditing(null); setForm(empty); await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save gift") }
    finally { lock.release(); setSaving(false) }
  }
  const archive = async (gift: Gift) => {
    if (!lock.acquire()) return
    setSaving(true)
    try { await apiFetchJson(`/api/admin/gifts/${encodeURIComponent(gift.id)}`, { method: "DELETE" }); await load(); toast.success("Gift archived") }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not archive gift") }
    finally { lock.release(); setSaving(false) }
  }
  const upload = (file?: File) => {
    if (!file) return
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 2 * 1024 * 1024) { toast.error("Choose a JPG, PNG, WebP or GIF up to 2 MB"); return }
    setReadingPhoto(true)
    const reader = new FileReader()
    reader.onload = () => { setForm(previous => ({ ...previous, photo: String(reader.result) })); setReadingPhoto(false) }
    reader.onerror = () => { toast.error("Could not read photo"); setReadingPhoto(false) }
    reader.readAsDataURL(file)
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Gift Listing</h1><p className="mt-1 text-gray-600">Manage gifts for Buy X, Get Y Product Free offers. Customers see eligible gifts only in cart and checkout.</p></div><Link className="text-blue-700 underline" href="/admin/promotions">Manage promotions</Link></div>
    <div className="rounded-lg border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">{editing ? "Edit gift" : "Add gift"}</h2>
      <fieldset disabled={saving || readingPhoto} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Gift SKU<input required disabled={!!editing} className="mt-1 block w-full rounded border p-2" value={form.sku} onChange={event => setForm({ ...form, sku: event.target.value.toUpperCase() })} /></label>
        <label className="text-sm">Name<input required className="mt-1 block w-full rounded border p-2" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label className="text-sm">Price (₹)<input type="number" min="0" step="0.01" className="mt-1 block w-full rounded border p-2" value={form.price} onChange={event => setForm({ ...form, price: Number(event.target.value) })} /></label>
        <label className="text-sm">MRP (₹)<input type="number" min="0" step="0.01" className="mt-1 block w-full rounded border p-2" value={form.mrp} onChange={event => setForm({ ...form, mrp: Number(event.target.value) })} /></label>
        <label className="text-sm">Photo URL<input className="mt-1 block w-full rounded border p-2" value={form.photo.startsWith("data:") ? "" : form.photo} onChange={event => setForm({ ...form, photo: event.target.value })} placeholder="https://… or upload a photo" /></label>
        <label className="text-sm">Upload photo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-2 block w-full" onChange={event => upload(event.target.files?.[0])} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} />Active</label>
        {form.photo && <img src={form.photo} alt="Gift photo preview" className="h-24 w-24 rounded border object-contain" />}
      </fieldset>
      <p className="mt-3 text-sm text-gray-600">Price and MRP show the gift’s value. Eligible gifts are always charged at ₹0.</p>
      <div className="mt-4 flex gap-3"><button disabled={saving || readingPhoto} onClick={save} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{saving ? "Saving…" : editing ? "Update gift" : "Add gift"}</button>{editing && <button disabled={saving} onClick={() => { setEditing(null); setForm(empty) }} className="rounded border px-4 py-2">Cancel</button>}</div>
    </div>
    <div className="overflow-x-auto rounded-lg border bg-white p-5">{loading ? <p role="status">Loading gifts…</p> : error ? <div role="alert">{error}<button className="ml-3 text-blue-700 underline" onClick={load}>Retry</button></div> : !gifts.length ? <p>No gifts yet. Add a gift, then select its SKU in Promotions.</p> : <table className="w-full text-left text-sm"><thead><tr>{["Photo", "SKU", "Name", "Price", "MRP", "Status", "Actions"].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{gifts.map(gift => <tr key={gift.id} className="border-t"><td className="p-2"><img src={gift.photo} alt={gift.name} className="h-14 w-14 object-contain" /></td><td className="p-2 font-mono">{gift.sku}</td><td className="p-2">{gift.name}</td><td className="p-2">₹{gift.price.toLocaleString("en-IN")}</td><td className="p-2">₹{gift.mrp.toLocaleString("en-IN")}</td><td className="p-2">{gift.active ? "Active" : "Archived"}</td><td className="p-2"><button disabled={saving} className="mr-3 text-blue-700" onClick={() => { setEditing(gift.id); setForm({ sku: gift.sku, name: gift.name, photo: gift.photo, price: gift.price, mrp: gift.mrp, active: gift.active }) }}>Edit</button>{gift.active && <button disabled={saving} className="text-red-700" onClick={() => archive(gift)}>Archive</button>}</td></tr>)}</tbody></table>}</div>
  </div>
}
