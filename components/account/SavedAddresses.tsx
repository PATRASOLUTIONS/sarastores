"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, Home, MoreVertical, Plus, X } from "lucide-react"
import { z } from "zod"
import { toast } from "react-hot-toast"
import { useAuth } from "@/contexts/AuthContext"
import { apiFetch } from "@/lib/api-client"
import { indianStates } from "@/lib/indiaData"
import { SavedDeliveryAddressSchema, type SavedDeliveryAddress } from "@/lib/validation"
import styles from "./SavedAddresses.module.css"

type Draft = z.input<typeof SavedDeliveryAddressSchema>
export default function SavedAddresses() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<SavedDeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [managing, setManaging] = useState(false)
  const mutation = useRef(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const accountId = user?.id
  const ownerRef = useRef(accountId)
  ownerRef.current = accountId

  useEffect(() => {
    setAddresses([])
    setDraft(null)
    setError("")
    if (!accountId) { setLoading(false); return }
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const response = await apiFetch("/api/account/addresses", { signal: controller.signal })
        if (!response.ok) throw new Error("Saved addresses could not be loaded.")
        const result = z.object({ addresses: z.array(SavedDeliveryAddressSchema.extend({ id: z.string() })) }).parse(await response.json())
        if (!controller.signal.aborted) setAddresses(result.addresses)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Dashboard] Address book failed:", error)
        setError("Saved addresses could not be loaded. Please retry.")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [accountId, attempt])

  useEffect(() => {
    if (draft) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [!!draft])

  const newAddress = () => {
    const [firstName = "", ...lastName] = (user?.name || "").trim().split(/\s+/)
    setEditingId(null)
    setMenuId(null)
    setDraft({ type: "home", firstName, lastName: lastName.join(" "), phone: user?.phone || "", address: "",
      city: "", state: "Karnataka", pincode: "", country: "India" })
  }
  const editAddress = (address: SavedDeliveryAddress) => {
    setEditingId(address.id)
    setDraft(address)
    setMenuId(null)
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (mutation.current || !accountId) return
    const result = SavedDeliveryAddressSchema.safeParse(draft)
    if (!result.success) { toast.error(result.error.issues[0].message); return }
    mutation.current = true
    setSaving(true)
    const owner = accountId
    try {
      const response = await apiFetch(editingId ? `/api/account/addresses/${encodeURIComponent(editingId)}` : "/api/account/addresses", {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data),
      })
      const body: unknown = await response.json()
      if (!response.ok) {
        const failure = z.object({ error: z.string() }).safeParse(body)
        throw new Error(failure.success ? failure.data.error : "Address could not be saved.")
      }
      const saved = z.object({ address: SavedDeliveryAddressSchema.extend({ id: z.string() }) }).parse(body).address
      if (ownerRef.current !== owner) return
      setAddresses(previous => [saved, ...previous.filter(address => address.id !== saved.id)])
      setDraft(null)
      toast.success("Address saved for future checkouts")
    } catch (error) {
      if (ownerRef.current !== owner) return
      console.error("[Dashboard] Address save failed:", error)
      toast.error(error instanceof Error ? error.message : "Address could not be saved.")
    } finally { mutation.current = false; setSaving(false) }
  }
  const remove = async (id: string) => {
    if (mutation.current || !accountId) return
    mutation.current = true
    setSaving(true)
    const owner = accountId
    try {
      const response = await apiFetch(`/api/account/addresses/${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Address could not be removed.")
      if (ownerRef.current !== owner) return
      setAddresses(previous => previous.filter(address => address.id !== id))
      setMenuId(null)
      toast.success("Saved address removed")
    } catch (error) {
      if (ownerRef.current !== owner) return
      console.error("[Dashboard] Address removal failed:", error)
      toast.error(error instanceof Error ? error.message : "Address could not be removed.")
    } finally { mutation.current = false; setSaving(false) }
  }
  const change = (field: keyof Draft, value: string) => setDraft(previous => previous ? { ...previous, [field]: value } : previous)
  return <section id="my-addresses" className={styles.panel}>
    <header><h2>My Addresses</h2><button type="button" onClick={() => { setManaging(value => !value); setMenuId(null) }}>{managing ? "Done" : "Manage Addresses"} <span aria-hidden="true">→</span></button></header>
    <div className={styles.list}>
      {loading ? <p role="status">Loading saved addresses...</p> : error ? <p role="alert">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry addresses</button></p> :
        addresses.length ? addresses.map(address => <div key={address.id} className={styles.address}>
          {address.type === "work" ? <Building2 size={26} /> : <Home size={26} />}
          <div><strong>{address.type === "work" ? "Office" : address.type === "other" ? "Other" : "Home"}</strong>
            <p>{address.address}</p><p>{address.city} - {address.pincode}</p></div>
          <div className={styles.menu}><button type="button" aria-label={`Manage ${address.type} address: ${address.address}`}
            aria-expanded={menuId === address.id} onClick={() => setMenuId(value => value === address.id ? null : address.id)}><MoreVertical size={16} /></button>
            {menuId === address.id && <div><button type="button" onClick={() => editAddress(address)}>Edit address</button>
              <button type="button" disabled={saving} onClick={() => void remove(address.id)}>Remove address</button></div>}
          </div>
          {managing && <div className={styles.manageActions}><button type="button" onClick={() => editAddress(address)}>Edit</button>
            <button type="button" disabled={saving} onClick={() => void remove(address.id)}>Remove</button></div>}
        </div>) : user?.address?.street ? <div className={styles.address}><Home size={26} /><div><strong>Account address</strong>
          <p>{user.address.street}</p><p>{[user.address.city, user.address.zip].filter(Boolean).join(" - ")}</p>
          <small>Save a delivery address below to manage it here.</small></div></div> : <p>No delivery addresses saved yet.</p>}
      <button type="button" className={styles.add} disabled={saving} onClick={newAddress}>Add New Address <Plus size={13} /></button>
    </div>
    <dialog ref={dialogRef} className={styles.dialog} onCancel={event => { if (saving) event.preventDefault(); else setDraft(null) }}>
      {draft && <form onSubmit={save}>
        <header><h2>{editingId ? "Edit saved address" : "Add delivery address"}</h2><button type="button" aria-label="Close address editor" disabled={saving} onClick={() => setDraft(null)}><X size={20} /></button></header>
        <fieldset disabled={saving} className={styles.form}>
          <label>Address label<select value={draft.type} onChange={event => change("type", event.target.value)}><option value="home">Home</option><option value="work">Office</option><option value="other">Other</option></select></label>
          <label>First name<input name="addressFirstName" value={draft.firstName} onChange={event => change("firstName", event.target.value)} required /></label>
          <label>Last name<input value={draft.lastName} onChange={event => change("lastName", event.target.value)} /></label>
          <label>Mobile number<input type="tel" name="addressPhone" value={draft.phone} onChange={event => change("phone", event.target.value)} required /></label>
          <label className={styles.wide}>Street address<textarea name="savedStreet" value={draft.address} onChange={event => change("address", event.target.value)} required rows={3} /></label>
          <label>State<select name="addressState" value={draft.state} onChange={event => change("state", event.target.value)} required><option value="">Choose state</option>{indianStates.map(state => <option key={state}>{state}</option>)}</select></label>
          <label>City<input name="addressCity" value={draft.city} onChange={event => change("city", event.target.value)} required maxLength={50} /></label>
          <label>Pincode<input name="addressPincode" value={draft.pincode} onChange={event => change("pincode", event.target.value)} required /></label>
          <p className={styles.wide}>Save an Indian address. Delivery availability is checked at checkout.</p>
          <button className={styles.save} type="submit">{saving ? "Saving..." : "Save Address"}</button>
        </fieldset>
      </form>}
    </dialog>
  </section>
}
