// Sara-owned cache only. Never cache navigations, customer/admin APIs or payment data.
const STATIC_CACHE = 'sara-static-v5'
const PUBLIC_CACHE = 'sara-public-v5'
const API_PATHS = new Set(['/api/products/listing', '/api/categories', '/api/home-components'])
const FIXED_ASSETS = new Set(['/sara-logo.png', '/icons/icon-192.png', '/icons/icon-512.png'])
const OWNED_CACHE = /^(app-cache-v[0-9]+|api-cache-v[0-9]+|sara-static-v[0-9]+|sara-public-v[0-9]+)$/
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => OWNED_CACHE.test(key) && ![STATIC_CACHE, PUBLIC_CACHE].includes(key))
    .map(key => caches.delete(key)))).then(() => self.clients.claim())
))
function cacheTtl(response, api) {
  const control = response.headers.get('cache-control') || ''
  const vary = response.headers.get('vary') || ''
  if (!response.ok || response.status !== 200 || response.type === 'opaque' || response.headers.has('set-cookie') ||
      /(?:private|no-store|no-cache)/i.test(control) || /(?:\*|cookie|authorization)/i.test(vary)) return 0
  const seconds = Number(control.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i)?.[1] || 0)
  if (api && !/(?:^|,)\s*public(?:,|$)/i.test(control)) return 0
  const age = Math.max(0, Number(response.headers.get('age')) || 0)
  return Math.min(Math.max(0, seconds - age) * 1000, api ? 300000 : 86400000)
}
function fresh(response) {
  const stored = Number(response.headers.get('sara-cached-at'))
  const ttl = Number(response.headers.get('sara-cache-ttl'))
  return stored > 0 && ttl > 0 && Date.now() >= stored && Date.now() - stored < ttl
}
async function put(cache, request, response, ttl, maxEntries) {
  const headers = new Headers(response.headers)
  headers.set('sara-cached-at', String(Date.now()))
  headers.set('sara-cache-ttl', String(ttl))
  const bytes = await response.clone().arrayBuffer()
  if (bytes.byteLength > 2000000) { await cache.delete(request); return }
  const copy = new Response(bytes, {status: response.status, statusText: response.statusText, headers})
  await cache.put(request, copy)
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map(key => cache.delete(key)))
}
async function serve(event, api) {
  const request = event.request
  let cache, cached
  try {
    cache = await caches.open(api ? PUBLIC_CACHE : STATIC_CACHE)
    cached = await cache.match(request)
  } catch { /* Storage can be disabled; normal network access must still work. */ }
  if (!api && cached && fresh(cached)) return cached
  const network = fetch(request).then(async response => {
    const ttl = cacheTtl(response, api)
    try {
      if (cache && ttl && (!response.url || new URL(response.url).origin === self.location.origin)) {
        await put(cache, request, response, ttl, api ? 60 : 100)
      } else if (cache) await cache.delete(request)
    } catch { /* Cache quota/failures must never turn a good network response into an error. */ }
    return response
  })
  event.waitUntil(network.then(() => {}, () => {}))
  if (cached && fresh(cached)) return cached
  if (cached) { try { await cache.delete(request) } catch { /* Discard expired data even if deletion fails. */ } }
  try { return await network }
  catch { return new Response('Offline: this resource needs a current network response.', {status: 503, headers: {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'}}) }
}
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || request.mode === 'navigate' || ['no-store','reload','no-cache'].includes(request.cache) || request.headers.has('authorization') || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (API_PATHS.has(url.pathname)) {
    if (['fields','include_inactive','userId','token'].some(key => url.searchParams.has(key))) return
    event.respondWith(serve(event, true));return
  }
  if (!url.search && (url.pathname.startsWith('/_next/static/') || FIXED_ASSETS.has(url.pathname))) event.respondWith(serve(event, false))
})
