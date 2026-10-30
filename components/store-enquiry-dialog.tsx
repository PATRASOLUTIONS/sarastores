"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { Loader2, MapPin, Phone, Star, ArrowUpRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiFetchJson } from "@/lib/api-client"
import type { StoreBusiness } from "@/lib/store-business-types"
import { getStoreBusiness } from "@/lib/store-business-client"
import type { Store } from "@/lib/store-data"
import type { Coordinates } from "@/lib/geo-client"
import { z } from "zod"

const leadResponse = z.object({ success: z.literal(true), message: z.string(), id: z.string() })

export function StoreEnquiryDialog({ store, origin, onClose }: { store: Store; origin: Coordinates | null; onClose: () => void }) {
  const [business, setBusiness] = useState<StoreBusiness | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(true)
  const [detailsError, setDetailsError] = useState("")
  const [googlePhotoFailed, setGooglePhotoFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const sendingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setDetailsLoading(true)
    setDetailsError("")
    void getStoreBusiness(store.id, retry > 0)
      .then(data => { if (!cancelled) setBusiness(data) })
      .catch(error => { if (!cancelled) setDetailsError(error instanceof Error ? error.message : "Could not load Google details") })
      .finally(() => { if (!cancelled) setDetailsLoading(false) })
    return () => { cancelled = true }
  }, [store.id, retry])

  useEffect(() => { setGooglePhotoFailed(false) }, [business?.photoUrl])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sendingRef.current || success) return
    const data = new FormData(event.currentTarget)
    sendingRef.current = true
    setSending(true)
    setError("")
    try {
      const result = await apiFetchJson("/api/leads", {
        method: "POST", signal: AbortSignal.timeout(15000),
        json: {
          name: String(data.get("name") || "").trim(), email: String(data.get("email") || "").trim().toLowerCase(),
          phone: String(data.get("phone") || ""), message: String(data.get("message") || "").trim(),
          source: "store_locator", storeId: store.id,
          contactConsent: data.get("contactConsent") === "on", promotionalConsent: data.get("promotionalConsent") === "on",
        },
      }, value => leadResponse.parse(value))
      setSuccess(result.message)
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send your enquiry. Please try again.") }
    finally { sendingRef.current = false; setSending(false) }
  }

  const name = business?.name || store.name
  const address = business?.address || store.address
  const phone = business?.phone || store.phone
  const googlePhoto = !googlePhotoFailed && business?.photoUrl
  const query = encodeURIComponent(`${store.name}, ${store.address}`)
  const mapsUrl = business?.mapsUrl || store.mapUrl || `https://www.google.com/maps/search/?api=1&query=${query}`
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${name}, ${address}`)}${origin ? `&origin=${origin.lat},${origin.lng}` : ""}`
  const inputClass = "mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
  const actionClass = "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium"
  const secondaryActionClass = `${actionClass} border-gray-200 bg-white hover:bg-gray-100`

  return <Dialog open onOpenChange={open => { if (!open && !sendingRef.current) onClose() }}>
    <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl bg-white p-0 sm:rounded-2xl"
      onEscapeKeyDown={event => { if (sending) event.preventDefault() }} onInteractOutside={event => { if (sending) event.preventDefault() }}>
      <DialogHeader className="border-b border-gray-100 px-6 pb-5 pt-6 pr-10 text-left">
        <DialogTitle className="text-xl tracking-tight">{store.name}</DialogTitle>
        <DialogDescription>Connect with this store and plan your visit.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-0 md:grid-cols-2">
        <section className="p-6" aria-label="Store enquiry">
          <h2 className="text-lg font-semibold tracking-tight">How can we help?</h2>
          <p className="mb-5 mt-1 text-sm text-gray-500">Leave your details and our team will get in touch.</p>
          {success ? <div role="status" className="rounded-xl bg-green-50 p-5 text-sm text-green-800"><p>{success}</p><button type="button" onClick={onClose} className="mt-4 font-semibold underline">Done</button></div> :
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={sending} className="space-y-4">
              <div><label htmlFor="store-lead-name" className="text-sm font-medium">Name</label><input id="store-lead-name" name="name" autoComplete="name" required minLength={3} maxLength={100} className={inputClass} /></div>
              <div><label htmlFor="store-lead-email" className="text-sm font-medium">Email</label><input id="store-lead-email" name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} /></div>
              <div><label htmlFor="store-lead-phone" className="text-sm font-medium">Phone number</label><input id="store-lead-phone" name="phone" type="tel" autoComplete="tel-national" inputMode="tel" required pattern="[0-9]{10}" maxLength={10} title="Enter your 10-digit phone number" className={inputClass} /></div>
              <div><label htmlFor="store-lead-message" className="text-sm font-medium">Message</label><textarea id="store-lead-message" name="message" required maxLength={5000} rows={3} className={`${inputClass} resize-y`} /></div>
              <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-600"><input name="contactConsent" type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" /><span>I accept the <Link href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Terms & Conditions</Link> and <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Privacy Policy</Link>, and agree to receive notifications, WhatsApp messages and calls about this enquiry.</span></label>
              <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-600"><input name="promotionalConsent" type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" /><span>I would also like to receive promotional messages and offers. Optional; you can withdraw this consent.</span></label>
            </fieldset>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={sending} type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{sending && <Loader2 size={16} className="animate-spin" />}{sending ? "Sending..." : "Send enquiry"}</button>
          </form>}
        </section>
        <section className="border-t border-gray-100 bg-gray-50 p-6 md:border-l md:border-t-0" aria-label="Store business details">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">{business?.status === "connected" ? "From Google Maps" : "Store details"}</p>
          <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
          {(googlePhoto || store.image) && <figure className="mt-4 overflow-hidden rounded-xl">
            <img src={googlePhoto || store.image} alt={name} loading="lazy" className="h-44 w-full object-cover" onError={event => {
              if (googlePhoto) setGooglePhotoFailed(true)
              else event.currentTarget.style.display = "none"
            }} />
            {!!googlePhoto && <figcaption className="mt-1 text-xs text-gray-500">Photo: Google{business?.photoCredits?.map((credit, index) => credit.url ? <a key={index} href={credit.url} target="_blank" rel="noopener noreferrer" className="underline"> / {credit.name}</a> : <span key={index}> / {credit.name}</span>)}</figcaption>}
          </figure>}
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-gray-600"><MapPin size={17} className="mt-0.5 shrink-0" />{address}</p>
          {phone && <p className="mt-3 flex items-center gap-2 text-sm text-gray-600"><Phone size={16} />{phone}</p>}
          <div className="mt-4 space-y-1 text-xs text-gray-500">{(business?.hours.length ? business.hours : [store.hours]).map((hours, index) => <p key={index}>{hours}</p>)}</div>
          <div className="mt-5 flex flex-wrap gap-2">
            {phone && <a className={`${actionClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Phone size={15} />Call now</a>}
            <a className={secondaryActionClass} href={directions} target="_blank" rel="noopener noreferrer"><MapPin size={15} />Directions</a>
            <a className={secondaryActionClass} href={business?.reviewsUrl || mapsUrl} target="_blank" rel="noopener noreferrer"><Star size={15} />Reviews</a>
            <a className={secondaryActionClass} href={business?.writeReviewUrl || mapsUrl} target="_blank" rel="noopener noreferrer">Write a review<ArrowUpRight size={15} /></a>
          </div>
          {detailsLoading && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin" />Loading Google details...</p>}
          {detailsError && <p role="alert" className="mt-5 text-xs text-gray-600">{detailsError} <button type="button" onClick={() => setRetry(value => value + 1)} className="text-blue-600 underline">Retry</button></p>}
          {!detailsLoading && (!business || business.status !== "connected") && <p className="mt-5 text-xs leading-relaxed text-gray-500">Live Google reviews are unavailable here. Open Google Maps to view this store and its reviews.{!business?.writeReviewUrl && " Choose the business listing, then select Write a review."}</p>}
          {business?.rating != null && <div className="mt-6 flex items-center gap-2 border-t border-gray-200 pt-5"><Star size={18} className="fill-amber-400 text-amber-400" /><strong>{business.rating.toFixed(1)}</strong><span className="text-xs text-gray-500">({business.reviewCount || 0} Google reviews)</span></div>}
          {!!business?.reviews.length && <div className="mt-4 space-y-3">{business.reviews.map((review, index) => <article key={index} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 text-sm font-medium">{review.authorUrl ? <a href={review.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{review.author}</a> : <span>{review.author}</span>}<span className="flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" />{review.rating}/5</span></div>
            {review.text && <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-600">{review.text}</p>}<p className="mt-2 text-xs text-gray-400">{review.date}</p>
          </article>)}</div>}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-blue-600">View on Google Maps<ArrowUpRight size={13} /></a>
        </section>
      </div>
    </DialogContent>
  </Dialog>
}
