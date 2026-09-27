'use client'

// utils/cache.ts
// High-performance caching: in-memory + IndexedDB persistence + stale-while-revalidate

export type CacheEntry<T> = {
  data: T
  timestamp: number
}

// ─── In-Memory Cache (instant access, single page session) ───────────────
const MEMORY_CACHE: Record<string, CacheEntry<any>> = {}
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = MEMORY_CACHE[key]
  if (!entry) return null
  if (Date.now() - entry.timestamp > ttl) return null
  return entry.data
}

export function setCached<T>(key: string, data: T): void {
  MEMORY_CACHE[key] = { data, timestamp: Date.now() }
  // Persist to IndexedDB in background (fire-and-forget)
  idbSet(key, data).catch(() => {})
}

// ─── IndexedDB Persistence Layer ─────────────────────────────────────────

const DB_NAME = 'app-cache'
const DB_VERSION = 1
const STORE_NAME = 'cache-store'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('No IndexedDB'))
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function idbSet<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ data, timestamp: Date.now() }, key)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* memory cache still works */ }
}

async function idbGet<T>(key: string, ttl: number): Promise<T | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    const result = await new Promise<any>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    if (!result) return null
    if (Date.now() - result.timestamp > ttl) return null
    return result.data as T
  } catch { return null }
}

async function idbGetStale<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    const result = await new Promise<any>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    if (!result) return null
    return { data: result.data as T, timestamp: result.timestamp }
  } catch { return null }
}

// ─── Main fetch with stale-while-revalidate ──────────────────────────────

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  // 1. In-memory (instant, sub-ms)
  const memCached = getCached<T>(key, ttl)
  if (memCached !== null) return memCached

  // 2. IndexedDB (fast, survives refresh)
  const idbCached = await idbGet<T>(key, ttl)
  if (idbCached !== null) {
    MEMORY_CACHE[key] = { data: idbCached, timestamp: Date.now() }
    return idbCached
  }

  // 3. Stale data — show immediately, revalidate in background
  const staleData = await idbGetStale<T>(key)
  const freshPromise = fetcher().then(data => {
    setCached(key, data)
    return data
  })

  if (staleData) {
    MEMORY_CACHE[key] = { data: staleData.data, timestamp: Date.now() }
    freshPromise.catch(() => {}) // revalidate silently
    return staleData.data
  }

  // 4. No cache at all — must wait
  return freshPromise
}

// ─── Background revalidation ─────────────────────────────────────────────

export function revalidateCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  _ttl = DEFAULT_TTL
): void {
  fetcher()
    .then(data => setCached(key, data))
    .catch(() => {})
}

// ─── Prefetch: fire-and-forget cache warming ─────────────────────────────

export function prefetch<T>(key: string, fetcher: () => Promise<T>, ttl = DEFAULT_TTL): void {
  const memCached = getCached<T>(key, ttl)
  if (memCached !== null) return
  fetchWithCache(key, fetcher, ttl).catch(() => {})
}

// ─── Batch prefetch ──────────────────────────────────────────────────────

export function prefetchAll(
  items: Array<{ key: string; fetcher: () => Promise<any>; ttl?: number }>
): void {
  items.forEach(({ key, fetcher, ttl }) => prefetch(key, fetcher, ttl))
}

// ─── Read from any cache layer ───────────────────────────────────────────

export async function getFromCache<T>(key: string, ttl = DEFAULT_TTL): Promise<T | null> {
  const mem = getCached<T>(key, ttl)
  if (mem !== null) return mem
  const idb = await idbGet<T>(key, ttl)
  if (idb !== null) {
    MEMORY_CACHE[key] = { data: idb, timestamp: Date.now() }
    return idb
  }
  return null
}

// ─── Clear cache key ─────────────────────────────────────────────────────

export async function clearCache(key: string): Promise<void> {
  delete MEMORY_CACHE[key]
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
  } catch {}
}
