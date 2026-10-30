"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Star, MapPin, Phone, Image as ImageIcon } from "lucide-react"
import { apiFetchJson } from "@/lib/api-client"
import { AdminStoreBusinessResponseSchema, type AdminStoreBusinessResponse } from "@/lib/admin-store-business-types"

export function StoreGoogleDetails({ storeId }: { storeId: string }) {
  const [data, setData] = useState<AdminStoreBusinessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [photoFailed, setPhotoFailed] = useState(false)
  const controller = useRef<AbortController | null>(null)

  async function load(refresh = false) {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setLoading(true)
    setError("")
    try {
      const result = await apiFetchJson(`/api/admin/store-locations/${encodeURIComponent(storeId)}/google${refresh ? "?refresh=1" : ""}`, {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(40000)]),
      }, value => AdminStoreBusinessResponseSchema.parse(value))
      if (request.signal.aborted) return
      setData(result)
      setPhotoFailed(false)
    } catch (error) { if (!request.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load Google data") }
    finally { if (!request.signal.aborted) setLoading(false) }
  }

  useEffect(() => { setData(null); void load(); return () => controller.current?.abort() }, [storeId])
  const connected = data?.business.status === "connected"
  const business = data?.business
  const notFetched = "Not fetched"
  const rows = data ? [
    ["Store name", data.store.name, connected ? data.business.googleFields?.name : notFetched],
    ["Address", data.store.address, connected ? data.business.googleFields?.address : notFetched],
    ["Phone", data.store.phone, connected ? data.business.googleFields?.phone : notFetched],
    ["Opening hours", data.store.hours, connected ? data.business.googleFields?.hours?.join("\n") : notFetched],
    ["Google Place ID", data.store.placeId || "Not set", data.business.placeId || "Not resolved"],
  ] : []
  const actionClass = "inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50"

  return <div className="mx-auto max-w-6xl space-y-6 pb-10">
    <Link href="/admin/store-locations" className="inline-flex items-center gap-2 text-sm text-blue-600"><ArrowLeft size={16} />Store locations</Link>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight text-gray-900">Google store details</h1><p className="mt-1 text-sm text-gray-500">{data?.store.name || "Inspect the Google listing for this store"}</p></div>
      <div className="flex flex-wrap gap-2"><Link href={`/admin/store-locations?edit=${encodeURIComponent(storeId)}`} className={actionClass}>Edit store</Link><button disabled={loading} type="button" onClick={() => void load(true)} className={`${actionClass} disabled:opacity-50`}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{loading ? "Loading..." : "Refresh Google data"}</button></div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading && !data && <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border bg-white p-16 text-gray-500"><Loader2 className="animate-spin" />Fetching Google details...</div>}
    {data && business && <>
      <div className={`rounded-2xl border p-5 ${connected ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`} role="status">
        <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">{connected ? "Connected to Google" : business.status === "unavailable" ? "Google request failed" : "Google data not available"}</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-600">{data.store.active ? "Active" : "Inactive"} {data.store.locationType}</span>
          {data.store.code && <span className="text-xs text-gray-600">{data.store.code}</span>}</div>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">{business.statusMessage || "Google listing information"}</p>
        <p className="mt-2 text-xs text-gray-500">Last checked: {new Date(data.checkedAt).toLocaleString("en-IN")}. Refresh requests fresh data from Google.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b p-5"><h2 className="font-semibold">Saved details and Google data</h2><p className="mt-1 text-xs text-gray-500">Saved store values are shown separately when Google data is unavailable.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="p-4">Field</th><th className="p-4">Saved in platform</th><th className="p-4">From Google</th></tr></thead>
            <tbody>{rows.map(([label, saved, google]) => <tr key={label} className="border-t"><th className="p-4 align-top font-medium">{label}</th><td className="max-w-xs break-words whitespace-pre-line p-4 align-top text-gray-600">{saved || "Not set"}</td><td className="max-w-xs break-words whitespace-pre-line p-4 align-top text-gray-600">{google || "Not provided"}</td></tr>)}</tbody></table></div>
          <div className="flex flex-wrap gap-2 border-t p-5"><a href={business.mapsUrl} target="_blank" rel="noopener noreferrer" className={actionClass}><MapPin size={15} />Google Maps</a>
            {connected && business.phone && <a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`} className={actionClass}><Phone size={15} />Call</a>}
            <a href={business.reviewsUrl} target="_blank" rel="noopener noreferrer" className={actionClass}><Star size={15} />Reviews</a>
            {business.writeReviewUrl && <a href={business.writeReviewUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>Write a review<ExternalLink size={14} /></a>}</div>
        </section>
        <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="font-semibold">Google listing photo</h2></div>
          {business.photoUrl && !photoFailed ? <figure className="p-5"><img src={business.photoUrl} alt={`Google listing: ${business.name}`} onError={() => setPhotoFailed(true)} className="h-64 w-full rounded-xl object-cover" />
            <figcaption className="mt-3 text-xs text-gray-500">Photo: Google{business.photoCredits?.map((credit, index) => credit.url ? <a key={index} href={credit.url} target="_blank" rel="noopener noreferrer" className="underline"> / {credit.name}</a> : <span key={index}> / {credit.name}</span>)}</figcaption></figure> :
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-gray-500"><ImageIcon size={32} /><p>{photoFailed ? "The Google photo could not be displayed. Try refreshing the data." : business.photoMessage || "No Google photo was fetched for this listing."}</p></div>}
          {business.embedUrl && <iframe src={business.embedUrl} title={`Google Maps: ${data.store.name}`} className="h-72 w-full border-t" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />}
        </section>
      </div>
      <section className="rounded-2xl border bg-white p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Google reviews</h2>
        {connected && business.rating != null && <span className="flex items-center gap-2 text-sm"><Star size={16} className="fill-amber-400 text-amber-400" />{business.rating.toFixed(1)} / 5 <span className="text-gray-500">({business.reviewCount || 0} reviews)</span></span>}</div>
        {business.reviews.length ? <div className="grid gap-4 md:grid-cols-2">{business.reviews.map((review, index) => <article key={index} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex justify-between gap-3 text-sm font-medium">{review.authorUrl ? <a href={review.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{review.author}</a> : <span>{review.author}</span>}<span>{review.rating}/5</span></div>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{review.text || "Rating only"}</p><p className="mt-3 text-xs text-gray-400">{review.date}</p></article>)}</div> : <p className="text-sm text-gray-500">No Google reviews were fetched. Use Reviews to open the listing on Google.</p>}
      </section>
      <details className="rounded-2xl border bg-white p-5"><summary className="cursor-pointer text-sm font-medium">Inspect returned fields</summary><pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-gray-50 p-4 text-xs">{JSON.stringify(business, null, 2)}</pre></details>
    </>}
  </div>
}
