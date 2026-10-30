"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Search, Star, Phone, MapPin, Image as ImageIcon } from "lucide-react"
import { apiFetchJson } from "@/lib/api-client"
import { AdminStoreBusinessResponseSchema, GoogleStoreInventorySchema, type AdminStoreBusinessResponse, type GoogleStoreSummary } from "@/lib/admin-store-business-types"

type StoreResult = { stage: "queued" | "loading" | "ready" | "error"; data?: AdminStoreBusinessResponse; error?: string }
const FETCH_CONCURRENCY = 4
const detailsUrl = (id: string) => `/admin/store-locations/${encodeURIComponent(id)}/google`

function resultStatus(result?: StoreResult): "pending" | "failed" | "connected" | "not_configured" {
  if (!result || result.stage === "queued" || result.stage === "loading") return "pending"
  if (result.stage === "error" || result.data?.business.status === "unavailable") return "failed"
  return result.data?.business.status === "connected" ? "connected" : "not_configured"
}

function GoogleStoreCard({ store, result }: { store: GoogleStoreSummary; result?: StoreResult }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const business = result?.data?.business
  const status = resultStatus(result)
  const connected = status === "connected"
  useEffect(() => { setPhotoFailed(false) }, [business?.photoUrl])
  return <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
    <div className="relative flex h-52 items-center justify-center bg-gray-100">
      {business?.photoUrl && !photoFailed ? <img src={business.photoUrl} alt={`Google listing: ${business.name}`} loading="lazy" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} /> :
      <div className="flex flex-col items-center gap-2 px-5 text-center text-xs text-gray-500"><ImageIcon size={30} /><span>{status === "pending" ? "Waiting for Google photo" : photoFailed ? "Photo unavailable; refresh to try again" : business?.photoMessage || "No Google photo fetched"}</span></div>}
      <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium ${connected ? "bg-green-100 text-green-800" : status === "pending" ? "bg-white text-gray-600" : "bg-amber-100 text-amber-800"}`}>{connected ? "Google connected" : status === "pending" ? result?.stage === "loading" ? "Fetching..." : "Queued" : status === "failed" ? "Fetch failed" : "Not configured"}</span>
    </div>
    {!!business?.photoUrl && !photoFailed && <p className="px-5 pt-2 text-xs text-gray-400">Photo: Google{business.photoCredits?.map((credit, index) => credit.url ? <a key={index} href={credit.url} target="_blank" rel="noopener noreferrer" className="underline"> / {credit.name}</a> : <span key={index}> / {credit.name}</span>)}</p>}
    <div className="space-y-4 p-5">
      <div><h2 className="text-lg font-semibold tracking-tight"><Link href={detailsUrl(store.id)} className="hover:text-blue-600">{connected ? business?.googleFields?.name || store.name : store.name}</Link></h2>
        <p className="mt-1 text-xs text-gray-500">{store.code || "No store code"} · {store.active ? "Active" : "Inactive"} {store.locationType}</p></div>
      {status === "pending" ? <p className="flex items-center gap-2 text-sm text-gray-500">{result?.stage === "loading" && <Loader2 size={15} className="animate-spin" />}Google details will appear as they load.</p> :
        !connected ? <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">{result?.error || business?.statusMessage || "Google details unavailable"}</p> : null}
      <p className="flex items-start gap-2 text-sm leading-relaxed text-gray-600"><MapPin size={15} className="mt-0.5 shrink-0" />{connected ? business?.googleFields?.address || "Google did not provide an address" : store.address || "No saved address"}</p>
      {connected && business?.googleFields?.phone && <a href={`tel:${business.googleFields.phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-2 text-sm text-blue-600"><Phone size={15} />{business.googleFields.phone}</a>}
      {!!business?.googleFields?.hours?.length && <details className="text-sm"><summary className="cursor-pointer font-medium text-gray-600">Opening hours</summary><div className="mt-2 space-y-1 text-xs text-gray-500">{business.googleFields.hours.map((hours, index) => <p key={index}>{hours}</p>)}</div></details>}
      {connected && business?.rating != null && <div className="flex items-center gap-2 text-sm"><Star size={16} className="fill-amber-400 text-amber-400" /><strong>{business.rating.toFixed(1)}</strong><span className="text-gray-500">({business.reviewCount || 0} Google reviews)</span></div>}
      {!!business?.reviews.length && <details className="rounded-xl border border-gray-100 p-3"><summary className="cursor-pointer text-sm font-medium">View {business.reviews.length} fetched reviews</summary><div className="mt-3 space-y-3">{business.reviews.map((review, index) => <div key={index} className="border-t pt-3"><div className="flex justify-between gap-3 text-xs font-medium">{review.authorUrl ? <a href={review.authorUrl} target="_blank" rel="noopener noreferrer" className="underline">{review.author}</a> : <span>{review.author}</span>}<span>{review.rating}/5</span></div><p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-600">{review.text || "Rating only"}</p><p className="mt-2 text-xs text-gray-400">{review.date}</p></div>)}</div></details>}
      {business?.placeId && <p className="break-all text-xs text-gray-400">Place ID: {business.placeId}</p>}
      {result?.data?.checkedAt && <p className="text-xs text-gray-400">Last checked: {new Date(result.data.checkedAt).toLocaleString("en-IN")}</p>}
      <div className="flex flex-wrap gap-3 border-t pt-4 text-xs font-medium text-blue-600"><Link href={detailsUrl(store.id)}>Full details</Link>
        {business && <><a href={business.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">Google Maps<ExternalLink size={12} /></a><a href={business.reviewsUrl} target="_blank" rel="noopener noreferrer">Reviews</a>{business.writeReviewUrl && <a href={business.writeReviewUrl} target="_blank" rel="noopener noreferrer">Write a review</a>}</>}
        <Link href={`/admin/store-locations?edit=${encodeURIComponent(store.id)}`}>Edit store</Link></div>
    </div>
  </article>
}

export function GoogleStoreOverview() {
  const [stores, setStores] = useState<GoogleStoreSummary[]>([])
  const [results, setResults] = useState<Record<string, StoreResult>>({})
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const currentRun = useRef<AbortController | null>(null)

  async function fetchAll(list: GoogleStoreSummary[], refresh: boolean, run: AbortController) {
    setFetching(true)
    setResults(Object.fromEntries(list.map(store => [store.id, { stage: "queued" as const }])))
    let next = 0
    async function worker() {
      while (!run.signal.aborted) {
        const store = list[next++]
        if (!store) return
        setResults(previous => ({ ...previous, [store.id]: { stage: "loading" } }))
        try {
          const data = await apiFetchJson(`/api/admin/store-locations/${encodeURIComponent(store.id)}/google${refresh ? "?refresh=1" : ""}`, {
            signal: AbortSignal.any([run.signal, AbortSignal.timeout(40000)]),
          }, value => AdminStoreBusinessResponseSchema.parse(value))
          if (run.signal.aborted) return
          setResults(previous => ({ ...previous, [store.id]: { stage: "ready", data } }))
        } catch (error) {
          if (run.signal.aborted) return
          setResults(previous => ({ ...previous, [store.id]: { stage: "error", error: error instanceof Error ? error.message : "Unable to fetch Google data" } }))
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, list.length) }, () => worker()))
    if (!run.signal.aborted) setFetching(false)
  }

  async function start(refresh = false) {
    currentRun.current?.abort()
    const run = new AbortController()
    currentRun.current = run
    setError("")
    setInventoryLoading(true)
    try {
      const inventory = await apiFetchJson("/api/admin/store-locations/google", { signal: AbortSignal.any([run.signal, AbortSignal.timeout(20000)]) }, value => GoogleStoreInventorySchema.parse(value))
      if (run.signal.aborted) return
      setStores(inventory.stores)
      setInventoryLoading(false)
      await fetchAll(inventory.stores, refresh, run)
    } catch (error) {
      if (!run.signal.aborted) { setError(error instanceof Error ? error.message : "Unable to load the store overview"); setInventoryLoading(false); setFetching(false) }
    }
  }

  useEffect(() => { void start(); return () => currentRun.current?.abort() }, [])
  const counts = useMemo(() => stores.reduce((counts, store) => { counts[resultStatus(results[store.id])]++; return counts }, { connected: 0, failed: 0, not_configured: 0, pending: 0 }), [stores, results])
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase()
    return stores.filter(store => {
      const business = results[store.id]?.data?.business
      return (filter === "all" || resultStatus(results[store.id]) === filter) &&
        (!text || [store.name, store.code, store.address, business?.googleFields?.name || "", business?.googleFields?.address || "", business?.googleFields?.phone || ""].some(value => value.toLowerCase().includes(text)))
    })
  }, [stores, results, query, filter])
  const completed = stores.length - counts.pending
  const busy = inventoryLoading || fetching

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <Link href="/admin/store-locations" className="inline-flex items-center gap-2 text-sm text-blue-600"><ArrowLeft size={16} />Store locations</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Saved-store Google Places data</h1><p className="mt-1 text-sm text-gray-500">Photos, reviews and business details for every saved store, including inactive stores and warehouses.</p></div>
      <button type="button" disabled={busy} onClick={() => void start(true)} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{busy ? "Fetching Google data..." : "Refresh all Google data"}</button></div>
    <Link href="/admin/store-locations/business-profile" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600">Connect Google Business Profile and view all accessible businesses<ExternalLink size={14} /></Link>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" disabled={busy} onClick={() => void start()} className="ml-3 underline">Retry</button></div>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Total stores", stores.length], ["Google connected", counts.connected], ["Not configured", counts.not_configured], ["Fetch failed", counts.failed]].map(([label, count]) => <div key={String(label)} className="rounded-2xl border bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div>)}</div>
    <div className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap gap-3"><label className="relative min-w-56 flex-1"><Search size={16} className="absolute left-3 top-3 text-gray-400" /><span className="sr-only">Search Google store data</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, store code, address or phone" className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm" /></label>
      <select aria-label="Google fetch status" value={filter} onChange={event => setFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"><option value="all">All stores</option><option value="connected">Google connected</option><option value="not_configured">Not configured</option><option value="failed">Fetch failed</option><option value="pending">Pending</option></select></div>
      <p role="status" className="mt-3 text-xs text-gray-500">{inventoryLoading ? "Loading store list..." : `${completed} of ${stores.length} stores checked. Showing ${visible.length} stores.`} {fetching && "Results appear as Google requests finish."}</p>
      <p className="mt-2 text-xs text-gray-400">Google returns a limited selection of reviews and a listing photo. Missing Google data is clearly marked; saved platform details remain available in Full details.</p>
    </div>
    {inventoryLoading && !stores.length ? <div className="flex items-center justify-center gap-3 p-12 text-gray-500"><Loader2 className="animate-spin" />Loading stores...</div> :
      visible.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(store => <GoogleStoreCard key={store.id} store={store} result={results[store.id]} />)}</div> : <div className="rounded-2xl border bg-white p-10 text-center text-sm text-gray-500">{stores.length ? "No stores match your search or filter." : "No stores are available."}</div>}
  </div>
}
