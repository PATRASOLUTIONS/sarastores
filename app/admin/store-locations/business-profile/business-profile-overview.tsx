"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Search, Star, Phone, MapPin, Image as ImageIcon } from "lucide-react"
import { toast } from "react-hot-toast"
import { z } from "zod"
import { ApiError, apiFetchJson } from "@/lib/api-client"
import { BusinessProfileAccountsResponse, BusinessProfileLocationsResponse, BusinessProfileMediaResponse, BusinessProfileReviewsResponse,
  BusinessProfileStatusResponse, type BusinessProfileAccount, type BusinessProfileLocation, type BusinessProfileMedia, type BusinessProfileReview, type BusinessProfileStatus } from "@/lib/google-business-profile-types"

const BASE = "/api/admin/store-locations/business-profile"
type Source = { connectionId: string; account: string; accountLabel: string; email: string }
type Profile = { location: BusinessProfileLocation; sources: Source[] }
type Account = BusinessProfileAccount & { connectionId: string; email: string }
type Extras = { media: BusinessProfileMedia[]; customerMedia: BusinessProfileMedia[]; reviews: BusinessProfileReview[];
  averageRating?: number; totalReviews?: number; mediaNext?: string; customerNext?: string; reviewsNext?: string;
  mediaError?: string; customerError?: string; reviewsError?: string; loading: boolean; moreLoading?: boolean }
type Kind = "media" | "customer-media" | "reviews"
const emptyExtras = (): Extras => ({ media: [], customerMedia: [], reviews: [], loading: true })
const starRatings: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
const rating = (value?: string) => starRatings[value || ""] || 0
const message = (error: unknown) => error instanceof Error ? error.message : "Could not fetch Google Business Profile data."
const address = (location: BusinessProfileLocation) => {
  const place = location.storefrontAddress
  return place ? [...(place.addressLines || []), place.sublocality, place.locality, place.administrativeArea, place.postalCode, place.regionCode].filter(Boolean).join(", ") : "Service-area business; no public street address"
}
const mediaImage = (item?: BusinessProfileMedia) => item?.thumbnailUrl || item?.googleUrl
const time = (value?: { hours?: number; minutes?: number }) => `${String(value?.hours || 0).padStart(2, "0")}:${String(value?.minutes || 0).padStart(2, "0")}`

function ProfileCard({ profile, extra, loadMore }: { profile: Profile; extra?: Extras; loadMore: (profile: Profile, kind: Kind) => void }) {
  const [failedPhoto, setFailedPhoto] = useState(false)
  const { location, sources } = profile
  const photos = [...new Map([...(extra?.media || []), ...(extra?.customerMedia || [])].map(photo => [photo.name, photo])).values()]
  const cover = photos.find(photo => photo.locationAssociation?.category === "COVER") || photos.find(photo => photo.locationAssociation?.category === "PROFILE") || photos.find(photo => mediaImage(photo))
  const image = mediaImage(cover)
  useEffect(() => setFailedPhoto(false), [image])
  const maps = location.metadata?.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.title || ""} ${address(location)}`)}`
  const action = "inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
  return <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
    <div className="flex h-52 items-center justify-center bg-gray-100">{image && !failedPhoto ? <img src={image} alt={location.title || "Google business photo"} onError={() => setFailedPhoto(true)} loading="lazy" className="h-full w-full object-cover" /> :
      <div className="flex flex-col items-center gap-2 px-5 text-center text-xs text-gray-500"><ImageIcon size={30} /><span>{extra?.loading ? "Fetching Google photos..." : "No photo returned by Google"}</span></div>}</div>
    {image && !failedPhoto && <p className="px-5 pt-2 text-xs text-gray-400">Photo: Google Business Profile{cover?.attribution?.profileName ? ` / ${cover.attribution.profileName}` : ""}</p>}
    <div className="space-y-4 p-5">
      <div><h2 className="text-lg font-semibold tracking-tight">{location.title || location.name}</h2><p className="mt-1 text-xs text-gray-500">{location.storeCode || "No store code"} · {location.openInfo?.status?.replaceAll("_", " ") || "Google business listing"}</p>
        {location.categories?.primaryCategory?.displayName && <p className="mt-1 text-xs text-blue-600">{location.categories.primaryCategory.displayName}</p>}</div>
      <p className="flex items-start gap-2 text-sm leading-relaxed text-gray-600"><MapPin size={15} className="mt-0.5 shrink-0" />{address(location)}</p>
      {location.phoneNumbers?.primaryPhone && <a href={`tel:${location.phoneNumbers.primaryPhone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-2 text-sm text-blue-600"><Phone size={15} />{location.phoneNumbers.primaryPhone}</a>}
      {location.profile?.description && <details className="text-sm"><summary className="cursor-pointer font-medium">Business description</summary><p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-600">{location.profile.description}</p></details>}
      {!!location.regularHours?.periods?.length && <details className="text-sm"><summary className="cursor-pointer font-medium">Opening hours</summary><div className="mt-2 space-y-1 text-xs text-gray-500">{location.regularHours.periods.map((period, index) => <p key={index}>{period.openDay}: {time(period.openTime)}–{time(period.closeTime)}{period.closeDay !== period.openDay ? ` (${period.closeDay})` : ""}</p>)}</div></details>}
      {extra?.loading && <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={14} className="animate-spin" />Fetching photos and reviews...</p>}
      {extra?.averageRating != null && <p className="flex items-center gap-2 text-sm"><Star size={16} className="fill-amber-400 text-amber-400" /><strong>{extra.averageRating.toFixed(1)}</strong><span className="text-gray-500">({extra.totalReviews || 0} reviews)</span></p>}
      <details className="rounded-xl border border-gray-100 p-3"><summary className="cursor-pointer text-sm font-medium">Photos and videos ({photos.length} fetched)</summary>
        {extra?.mediaError && <p className="mt-3 text-xs text-amber-700">Business photos: {extra.mediaError}</p>}{extra?.customerError && <p className="mt-3 text-xs text-amber-700">Customer photos: {extra.customerError}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">{photos.map(photo => <figure key={photo.name} className="min-w-0">{mediaImage(photo) && <a href={photo.googleUrl || photo.thumbnailUrl} target="_blank" rel="noopener noreferrer"><img src={mediaImage(photo)} alt={photo.description || "Google business photo"} loading="lazy" className="h-28 w-full rounded-lg object-cover" /></a>}<figcaption className="mt-1 text-xs text-gray-400">{photo.mediaFormat || "PHOTO"}{photo.attribution?.profileName ? ` / ${photo.attribution.profileName}` : ""}</figcaption></figure>)}</div>
        {!photos.length && !extra?.loading && <p className="mt-3 text-xs text-gray-500">Google has not returned any photos.</p>}
        <div className="mt-3 flex flex-wrap gap-3">{extra?.mediaNext && <button disabled={extra.moreLoading} type="button" onClick={() => loadMore(profile, "media")} className={action}>Load more business photos</button>}{extra?.customerNext && <button disabled={extra.moreLoading} type="button" onClick={() => loadMore(profile, "customer-media")} className={action}>Load more customer photos</button>}</div>
      </details>
      <details className="rounded-xl border border-gray-100 p-3"><summary className="cursor-pointer text-sm font-medium">Reviews ({extra?.reviews.length || 0} fetched)</summary>
        {extra?.reviewsError && <p className="mt-3 text-xs text-amber-700">{extra.reviewsError}</p>}
        <div className="mt-3 space-y-4">{extra?.reviews.map(review => <div key={review.reviewId} className="border-t pt-3"><div className="flex justify-between gap-3 text-xs font-medium"><span>{review.reviewer?.displayName || "Google reviewer"}</span><span>{rating(review.starRating) || "—"}/5</span></div><p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-600">{review.comment || "Rating only"}</p><p className="mt-2 text-xs text-gray-400">{review.updateTime ? new Date(review.updateTime).toLocaleDateString("en-IN") : ""}</p>{review.reviewReply?.comment && <div className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600"><strong>Business reply</strong><p className="mt-1 whitespace-pre-line">{review.reviewReply.comment}</p></div>}</div>)}</div>
        {!extra?.reviews.length && !extra?.loading && !extra?.reviewsError && <p className="mt-3 text-xs text-gray-500">No reviews returned by Google.</p>}
        {extra?.reviewsNext && <button disabled={extra.moreLoading} type="button" onClick={() => loadMore(profile, "reviews")} className={`${action} mt-3`}>Load more reviews</button>}
      </details>
      {extra?.moreLoading && <p className="text-xs text-gray-500">Loading more Google data...</p>}
      <div className="flex flex-wrap gap-3 border-t pt-4"><a href={maps} target="_blank" rel="noopener noreferrer" className={action}>Google Maps<ExternalLink size={12} /></a>{location.websiteUri && <a href={location.websiteUri} target="_blank" rel="noopener noreferrer" className={action}>Website</a>}{location.metadata?.newReviewUri && <a href={location.metadata.newReviewUri} target="_blank" rel="noopener noreferrer" className={action}>Write a review</a>}</div>
      <p className="break-all text-xs text-gray-400">{sources.map(source => `${source.email} / ${source.accountLabel}`).join("; ")}</p>
      <details className="text-xs"><summary className="cursor-pointer text-gray-500">All fetched profile fields</summary><pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3">{JSON.stringify(location, null, 2)}</pre></details>
    </div>
  </article>
}

export function BusinessProfileOverview() {
  const [status, setStatus] = useState<BusinessProfileStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [selectedConnection, setSelectedConnection] = useState("all")
  const [accounts, setAccounts] = useState<Account[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [extras, setExtras] = useState<Record<string, Extras>>({})
  const extrasRef = useRef<Record<string, Extras>>({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState("")
  const [errors, setErrors] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [accountFilter, setAccountFilter] = useState("all")
  const [callbackMessage, setCallbackMessage] = useState("")
  const runRef = useRef<AbortController | null>(null)
  const paging = useRef(new Set<string>())
  const resourceSources = useRef<Record<string, Source>>({})

  function updateExtra(key: string, update: (old: Extras) => Extras) {
    const next = { ...extrasRef.current, [key]: update(extrasRef.current[key] || emptyExtras()) }
    extrasRef.current = next; setExtras(next)
  }
  async function loadStatus() {
    setStatusLoading(true)
    try { setStatus(await apiFetchJson(`${BASE}/status`, { signal: AbortSignal.timeout(15000) }, value => BusinessProfileStatusResponse.parse(value))) }
    catch (error) { setErrors([message(error)]) }
    finally { setStatusLoading(false) }
  }
  useEffect(() => {
    const result = new URL(window.location.href).searchParams.get("googleConnection")
    const known: Record<string, string> = { connected: "Google account connected. Your accessible business profiles will load below.",
      ACCESS_DENIED: "Google connection was cancelled or access was not granted.", INVALID_STATE: "Connection verification failed. Start again.", EXPIRED_STATE: "The connection request expired. Start again.",
      SCOPE_REQUIRED: "Allow Google Business Profile access when connecting.", OFFLINE_ACCESS_REQUIRED: "Google did not grant offline access. Remove this app from Google account permissions, then reconnect.",
      NOT_CONFIGURED: "Check your OAuth client and server connection setup.", RECONNECT_REQUIRED: "Google authorization failed. Check the redirect URI and reconnect.", IDENTITY_FAILED: "The Google identity could not be verified. Try again." }
    if (result) setCallbackMessage(known[result] || "Google connection could not be completed. Check setup and try again.")
    void loadStatus()
    return () => runRef.current?.abort()
  }, [])

  async function fetchResource(profile: Profile, kind: Kind, signal: AbortSignal, token = "") {
    const resourceKey = `${profile.location.name}:${kind}`
    const previousSource = resourceSources.current[resourceKey]
    // Page tokens belong to the Google account that produced the first page.
    const sources = token && previousSource ? [previousSource] : profile.sources
    let failure: unknown
    for (const source of sources) {
      if (signal.aborted) return
      try {
        const query = new URLSearchParams({ connectionId: source.connectionId, account: source.account, location: profile.location.name, kind })
        if (token) query.set("pageToken", token)
        if (kind === "reviews") {
          const data = await apiFetchJson(`${BASE}/location-data?${query}`, { signal }, value => BusinessProfileReviewsResponse.parse(value))
          if (signal.aborted) return
          resourceSources.current[resourceKey] = source
          updateExtra(profile.location.name, old => ({ ...old, reviews: [...new Map([...old.reviews, ...data.reviews].map(review => [review.reviewId, review])).values()],
            averageRating: data.averageRating ?? old.averageRating, totalReviews: data.totalReviewCount ?? old.totalReviews,
            reviewsNext: data.nextPageToken === token ? undefined : data.nextPageToken, reviewsError: undefined }))
        } else {
          const data = await apiFetchJson(`${BASE}/location-data?${query}`, { signal }, value => BusinessProfileMediaResponse.parse(value))
          if (signal.aborted) return
          resourceSources.current[resourceKey] = source
          updateExtra(profile.location.name, old => kind === "media" ? ({ ...old,
            media: [...new Map([...old.media, ...data.mediaItems].map(item => [item.name, item])).values()],
            mediaNext: data.nextPageToken === token ? undefined : data.nextPageToken, mediaError: undefined }) : ({ ...old,
            customerMedia: [...new Map([...old.customerMedia, ...data.mediaItems].map(item => [item.name, item])).values()],
            customerNext: data.nextPageToken === token ? undefined : data.nextPageToken, customerError: undefined }))
        }
        return
      } catch (error) {
        if (signal.aborted) return
        failure = error
        if (!(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) throw error
      }
    }
    throw failure || new Error("No accessible Google source was found for this location.")
  }
  async function loadMore(profile: Profile, kind: Kind) {
    const key = profile.location.name
    if (paging.current.has(key)) return
    const extra = extrasRef.current[key]
    const token = kind === "reviews" ? extra?.reviewsNext : kind === "media" ? extra?.mediaNext : extra?.customerNext
    if (!token) return
    paging.current.add(key); updateExtra(key, old => ({ ...old, moreLoading: true }))
    const run = runRef.current
    try { await fetchResource(profile, kind, AbortSignal.any([run?.signal || new AbortController().signal, AbortSignal.timeout(35000)]), token) }
    catch (error) { if (!run?.signal.aborted) toast.error(message(error)) }
    finally { if (run === runRef.current) paging.current.delete(key); if (!run?.signal.aborted) updateExtra(key, old => ({ ...old, moreLoading: false })) }
  }

  async function fetchProfiles() {
    if (!status?.configured) return
    runRef.current?.abort()
    const run = new AbortController(); runRef.current = run
    setBusy(true); setErrors([]); setAccounts([]); setProfiles([]); setAccountFilter("all")
    extrasRef.current = {}; setExtras({}); paging.current.clear(); resourceSources.current = {}
    const failures: string[] = []
    const allAccounts = new Map<string, Account>()
    const allProfiles = new Map<string, Profile>()
    const connections = status.connections.filter(connection => connection.status === "connected" && (selectedConnection === "all" || connection.id === selectedConnection))
    try {
      for (const connection of connections) {
        const parents = [""]; const visited = new Set<string>()
        while (parents.length && !run.signal.aborted) {
          const parent = parents.shift()!
          if (visited.has(parent)) continue
          visited.add(parent)
          let pageToken = ""; const pages = new Set<string>()
          try {
            do {
              if (run.signal.aborted) return
              if (pages.has(pageToken)) throw new Error("Google repeated an account page token. Refresh the account data.")
              pages.add(pageToken)
              setProgress(`Discovering accounts for ${connection.email}`)
              const query = new URLSearchParams({ connectionId: connection.id })
              if (parent) query.set("parentAccount", parent)
              if (pageToken) query.set("pageToken", pageToken)
              const data = await apiFetchJson(`${BASE}/accounts?${query}`, { signal: AbortSignal.any([run.signal, AbortSignal.timeout(35000)]) }, value => BusinessProfileAccountsResponse.parse(value))
              if (run.signal.aborted) return
              for (const account of data.accounts) {
                allAccounts.set(`${connection.id}:${account.name}`, { ...account, connectionId: connection.id, email: connection.email })
                if (["ORGANIZATION", "USER_GROUP"].includes(account.type || "") && !visited.has(account.name)) parents.push(account.name)
              }
              setAccounts([...allAccounts.values()]); pageToken = data.nextPageToken || ""
            } while (pageToken && !run.signal.aborted)
          } catch (error) { if (run.signal.aborted) return; failures.push(`${connection.email}: ${message(error)}`); setErrors([...failures]) }
        }
      }
      const candidates = [...allAccounts.values()]
      let accountIndex = 0
      async function accountWorker() {
        while (!run.signal.aborted) {
          const account = candidates[accountIndex++]
          if (!account) return
          let pageToken = ""; const pages = new Set<string>()
          try {
            do {
              if (run.signal.aborted) return
              if (pages.has(pageToken)) throw new Error("Google repeated a locations page token. Refresh the account data.")
              pages.add(pageToken)
              setProgress(`Fetching locations from ${account.accountName || account.name}`)
              const query = new URLSearchParams({ connectionId: account.connectionId, account: account.name })
              if (pageToken) query.set("pageToken", pageToken)
              const data = await apiFetchJson(`${BASE}/locations?${query}`, { signal: AbortSignal.any([run.signal, AbortSignal.timeout(35000)]) }, value => BusinessProfileLocationsResponse.parse(value))
              if (run.signal.aborted) return
              for (const location of data.locations) {
                const source: Source = { connectionId: account.connectionId, account: account.name, accountLabel: account.accountName || account.name, email: account.email }
                const existing = allProfiles.get(location.name)
                if (!existing) allProfiles.set(location.name, { location, sources: [source] })
                else if (!existing.sources.some(other => other.connectionId === source.connectionId && other.account === source.account)) existing.sources.push(source)
              }
              setProfiles([...allProfiles.values()]); pageToken = data.nextPageToken || ""
            } while (pageToken && !run.signal.aborted)
          } catch (error) { if (run.signal.aborted) return; failures.push(`${account.accountName || account.name}: ${message(error)}`); setErrors([...failures]) }
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, () => accountWorker()))
      if (run.signal.aborted) return
      const list = [...allProfiles.values()]; let profileIndex = 0; let complete = 0
      async function profileWorker() {
        while (!run.signal.aborted) {
          const profile = list[profileIndex++]
          if (!profile) return
          updateExtra(profile.location.name, () => emptyExtras())
          const kinds: Kind[] = ["media", "customer-media", "reviews"]
          await Promise.all(kinds.map(async kind => {
            try { await fetchResource(profile, kind, AbortSignal.any([run.signal, AbortSignal.timeout(35000)])) }
            catch (error) {
              if (run.signal.aborted) return
              const field = kind === "reviews" ? "reviewsError" : kind === "media" ? "mediaError" : "customerError"
              updateExtra(profile.location.name, old => ({ ...old, [field]: message(error) }))
            }
          }))
          if (run.signal.aborted) return
          updateExtra(profile.location.name, old => ({ ...old, loading: false }))
          setProgress(`Photos and reviews checked for ${++complete} of ${list.length} profiles`)
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, list.length) }, () => profileWorker()))
      if (!run.signal.aborted) setProgress(`Fetched ${allProfiles.size} unique Google business profiles from ${allAccounts.size} accounts/groups.`)
    } catch (error) { if (!run.signal.aborted) setErrors([...failures, message(error)]) }
    finally { if (!run.signal.aborted) setBusy(false) }
  }

  useEffect(() => { if (status?.configured && status.connections.some(connection => connection.status === "connected")) void fetchProfiles() }, [status, selectedConnection])
  async function disconnect(id: string) {
    try {
      await apiFetchJson(`${BASE}/status`, { method: "DELETE", json: { connectionId: id }, signal: AbortSignal.timeout(15000) }, value => z.object({ success: z.literal(true) }).parse(value))
      runRef.current?.abort(); setBusy(false); setProfiles([]); setAccounts([]); toast.success("Google connection removed from this app."); setSelectedConnection("all"); await loadStatus()
    } catch (error) { toast.error(message(error)) }
  }
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase()
    return profiles.filter(profile => (accountFilter === "all" || profile.sources.some(source => `${source.connectionId}:${source.account}` === accountFilter)) &&
      (!text || [profile.location.title || "", profile.location.storeCode || "", address(profile.location), profile.location.phoneNumbers?.primaryPhone || "", ...profile.sources.map(source => source.email)].some(value => value.toLowerCase().includes(text))))
  }, [profiles, query, accountFilter])

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <Link href="/admin/store-locations" className="inline-flex items-center gap-2 text-sm text-blue-600"><ArrowLeft size={16} />Store locations</Link>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Google Business Profile accounts</h1><p className="mt-1 max-w-2xl text-sm text-gray-500">Connect your Google account to fetch every business profile and group you can access, including locations not yet saved in this platform.</p></div>
      <Link href="/admin/store-locations/google" className="text-sm text-blue-600 underline">Saved-store Google Places data</Link></div>
    {callbackMessage && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{callbackMessage}</p>}
    <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold">Google account connection</h2><p className="mt-1 text-xs text-gray-500">Connections are private to your signed-in admin account. Google requests Business Profile management permission; this page reads account, location, photo and review data.</p></div>
      {status?.configured && <a href={`${BASE}/connect`} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"><ExternalLink size={15} />{status.connections.length ? "Connect another Google account" : "Connect Google Business Profile"}</a>}</div>
      {statusLoading && <p className="mt-4 text-sm text-gray-500">Checking connection setup...</p>}
      {status && !status.configured && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"><p className="font-medium">Complete the server setup to connect:</p><ul className="mt-2 list-disc space-y-1 pl-5">{status.missing.map(item => <li key={item}>{item}</li>)}</ul></div>}
      {!!status?.connections.length && <div className="mt-4 space-y-2">{status.connections.map(connection => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm"><span>{connection.email}<span className="ml-2 text-xs text-gray-500">{connection.status === "connected" ? "Connected" : "Reconnect required"}</span></span><button type="button" onClick={() => void disconnect(connection.id)} className="text-xs text-red-600 hover:underline">Disconnect</button></div>)}</div>}
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-gray-600">Google Cloud setup instructions</summary><div className="mt-3 space-y-3 text-xs leading-relaxed text-gray-600">
        <p>Request Google Business Profile API access for your Google Cloud project. Enable My Business Account Management API, My Business Business Information API and Google My Business API (for photos and reviews). A Places API key does not grant access to owned/managed business profiles.</p>
        <p>Create an OAuth web application client, configure its consent screen, and add the business.manage scope. If the app is in Testing, add the Google account as a test user; Google may require OAuth verification for production.</p>
        <p>Authorized redirect URI:</p><code className="block break-all rounded-lg bg-gray-50 p-3">{status?.redirectUri || "https://your-domain/api/admin/store-locations/business-profile/callback"}</code>
        <p>Set GOOGLE_BUSINESS_CLIENT_ID, GOOGLE_BUSINESS_CLIENT_SECRET, GOOGLE_BUSINESS_REDIRECT_URI and GOOGLE_BUSINESS_TOKEN_SECRET (at least 32 random characters), then restart or redeploy. The existing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET and API_KEY_ENCRYPTION_SECRET can be reused when configured. Keep the token encryption secret stable.</p>
        <div className="flex flex-wrap gap-3"><a href="https://developers.google.com/my-business/content/prereqs" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google API access prerequisites</a><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">OAuth credentials</a><a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google account permissions</a></div>
      </div></details>
    </section>
    {!!status?.connections.length && <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center gap-3"><select aria-label="Connected Google account" value={selectedConnection} onChange={event => setSelectedConnection(event.target.value)} className="rounded-xl border px-3 py-2.5 text-sm"><option value="all">All connected Google accounts</option>{status.connections.map(connection => <option key={connection.id} value={connection.id}>{connection.email}</option>)}</select>
      <button disabled={busy || !status.configured} type="button" onClick={() => void fetchProfiles()} className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}{busy ? "Fetching..." : "Refresh all profiles"}</button></div><p role="status" className="mt-3 text-xs text-gray-500">{progress}</p></section>}
    {!!errors.length && <div role="alert" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">{errors.map((error, index) => <p key={index}>{error}</p>)}{!status && <button type="button" onClick={() => void loadStatus()} className="underline">Retry connection status</button>}</div>}
    <div className="grid grid-cols-3 gap-3">{[["Connected Google accounts", status?.connections.length || 0], ["Business accounts / groups", accounts.length], ["Unique business profiles", profiles.length]].map(([label, count]) => <div key={String(label)} className="rounded-2xl border bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div>)}</div>
    {!!accounts.length && <details className="rounded-2xl border bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">Accessible Google accounts and groups ({accounts.length})</summary><div className="mt-3 space-y-2">{accounts.map(account => <div key={`${account.connectionId}:${account.name}`} className="rounded-xl bg-gray-50 p-3 text-xs"><strong>{account.accountName || account.name}</strong><p className="mt-1 text-gray-500">{account.email} · {account.type} · {account.role || "Access granted by Google"}</p><p className="mt-1 text-gray-400">{account.name}</p></div>)}</div></details>}
    <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4"><label className="relative min-w-56 flex-1"><Search size={16} className="absolute left-3 top-3 text-gray-400" /><span className="sr-only">Search Google profiles</span><input value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm" placeholder="Search business name, code, address, phone or account" /></label>
      <select aria-label="Business account or group" value={accountFilter} onChange={event => setAccountFilter(event.target.value)} className="max-w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="all">All business accounts / groups</option>{accounts.map(account => <option key={`${account.connectionId}:${account.name}`} value={`${account.connectionId}:${account.name}`}>{account.accountName || account.name} ({account.email})</option>)}</select></div>
    {visible.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(profile => <ProfileCard key={profile.location.name} profile={profile} extra={extras[profile.location.name]} loadMore={(profile, kind) => void loadMore(profile, kind)} />)}</div> :
      <div className="rounded-2xl border bg-white p-10 text-center text-sm text-gray-500">{busy ? "Discovering your Google business profiles..." : !status?.connections.length ? "Connect a Google account to see the business profiles you own or manage." : errors.length ? "Google could not return profiles. Review the access errors above." : "No Google profiles match this view. Check the account selection, access permissions or search filters."}</div>}
  </div>
}
