import { coordinates } from "@/lib/geo-client"

const shortHosts = ["maps.app.goo.gl", "goo.gl", "g.co"]

function googleMapHost(host: string) {
  return host === "google.com" || host.endsWith(".google.com") || host === "google.co.in" || host.endsWith(".google.co.in") || shortHosts.includes(host)
}

export function googleMapReference(link: string) {
  let url: URL | null = null
  try {
    const parsed = new URL(link)
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port && googleMapHost(parsed.hostname)) url = parsed
  } catch { /* Missing or invalid map link. */ }
  let path = url?.pathname || ""
  try { path = decodeURIComponent(path) } catch { /* Keep the original path. */ }
  const query = url?.searchParams.get("q") || url?.searchParams.get("query") || ""
  const placeId = url?.searchParams.get("query_place_id") || url?.searchParams.get("place_id") ||
    query.match(/^place_id:([A-Za-z0-9_-]+)$/)?.[1] || path.match(/!1s(ChI[A-Za-z0-9_-]+)/)?.[1] || ""
  let cid = url?.searchParams.get("cid") || url?.searchParams.get("ludocid") || ""
  const hexCid = path.match(/!1s0x[a-f0-9]+:(0x[a-f0-9]+)/i)?.[1]
  if (!cid && hexCid) { try { cid = BigInt(hexCid).toString() } catch { /* Invalid identifier. */ } }
  if (!/^\d+$/.test(cid)) cid = ""
  const point = path.match(/!3d([-\d.]+)!4d([-\d.]+)/) || query.match(/^([-\d.]+),\s*([-\d.]+)$/) || path.match(/@([-\d.]+),([-\d.]+)/)
  const coords = point ? coordinates(Number(point[1]), Number(point[2])) : null
  const name = path.match(/\/maps\/place\/([^/]+)/)?.[1].replace(/\+/g, " ") || ""
  return { url, placeId: /^[A-Za-z0-9_-]{1,200}$/.test(placeId) ? placeId : "", cid, coords, query, name }
}

export function googleStoreEmbed(link: string, name: string, address: string, storedPlaceId = "") {
  const reference = googleMapReference(link)
  if (reference.url?.pathname === "/maps/embed" && reference.url.searchParams.has("pb")) {
    const embed = new URL(reference.url)
    embed.hostname = "www.google.com"
    return embed.toString()
  }
  const url = new URL("https://www.google.com/maps")
  const placeId = storedPlaceId || reference.placeId
  url.searchParams.set("q", placeId ? `place_id:${placeId}` : reference.cid ? `cid:${reference.cid}` :
    reference.query || reference.name || `${name}, ${address}`)
  if (reference.cid) url.searchParams.set("cid", reference.cid)
  url.searchParams.set("output", "embed")
  return url.toString()
}

/** Resolve saved Google share links without allowing arbitrary outbound destinations. */
export async function resolveGoogleStoreLink(link: string, refresh = false) {
  let reference = googleMapReference(link)
  if (!reference.url || !shortHosts.includes(reference.url.hostname)) return reference
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(reference.url!.toString(), { redirect: "manual", signal: AbortSignal.timeout(4000), ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 3600 } }) })
    const location = response.headers.get("location")
    await response.body?.cancel()
    if (response.status < 300 || response.status >= 400 || !location) return reference
    const next = googleMapReference(new URL(location, reference.url!).toString())
    if (!next.url) return reference
    reference = next
    if (!shortHosts.includes(next.url.hostname)) return reference
  }
  return reference
}
