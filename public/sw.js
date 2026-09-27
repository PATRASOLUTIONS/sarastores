// Service Worker for caching API responses and static assets
// Uses Cache API with stale-while-revalidate strategy

const CACHE_NAME = 'app-cache-v3'
const API_CACHE_NAME = 'api-cache-v3'

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/sara-logo.png',
]

// API routes to cache with stale-while-revalidate
const CACHEABLE_API_PATTERNS = [
  /\/api\/products/,
  /\/api\/categories/,
  /\/api\/home-components/,
  /\/api\/settings/,
]

// Max age for API cache entries (5 minutes)
const API_CACHE_MAX_AGE = 5 * 60 * 1000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests
  if (request.method !== 'GET') return

  // Bypass cross-origin requests entirely. Caching/serving cross-origin
  // resources (images from external CDNs) via the service worker can lead
  // to opaque responses, CORS issues, or the worker returning its own
  // offline fallback (503). Let the browser handle cross-origin fetches
  // directly to avoid accidental blocking of external images (eg.
  // m.media-amazon.com).
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request).catch(() => new Response('Offline', { status: 503 })))
    return
  }

  // Handle API requests with stale-while-revalidate
  if (CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Handle static assets (images, fonts, CSS, JS) with cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }
})

// Stale-while-revalidate: return cached immediately, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE_NAME)
  const cachedResponse = await cache.match(request)

  // Fetch fresh data in background
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        // Clone before caching since response can only be consumed once
        const responseToCache = networkResponse.clone()
        // Add timestamp header for TTL checking
        const headers = new Headers(responseToCache.headers)
        headers.set('sw-cache-timestamp', Date.now().toString())

        responseToCache.blob().then(blob => {
          const cachedResp = new Response(blob, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers: headers,
          })
          cache.put(request, cachedResp)
        })
      }
      return networkResponse
    })
    .catch(() => cachedResponse) // Offline fallback

  // Return cached response immediately if available
  if (cachedResponse) {
    // Check if cache is still relatively fresh
    const timestamp = cachedResponse.headers.get('sw-cache-timestamp')
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp)
      if (age < API_CACHE_MAX_AGE) {
        // Fresh enough — still revalidate in background
        fetchPromise.catch(() => {})
        return cachedResponse
      }
    }
    // Stale but return it, network will update
    fetchPromise.catch(() => {})
    return cachedResponse
  }

  // No cache — must wait for network
  return fetchPromise
}

// Cache-first for static assets
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cachedResponse = await cache.match(request)
  if (cachedResponse) return cachedResponse

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot|ico)$/i.test(pathname) ||
    pathname.startsWith('/_next/static/')
}
