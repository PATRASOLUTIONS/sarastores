'use client'

import { z } from 'zod'

export type CacheParser<T> = { parse: (value: unknown) => T }
export type CacheEntry<T> = { data: T; timestamp: number }

const MEMORY_CACHE = new Map<string, CacheEntry<unknown>>()
const IN_FLIGHT = new Map<string, Promise<unknown>>()
const DEFAULT_TTL = 5 * 60 * 1000
const entrySchema = z.object({ data: z.unknown(), timestamp: z.number().finite().nonnegative() })
const DB_NAME = 'app-cache'
const STORE_NAME = 'cache-store'
let dbPromise: Promise<IDBDatabase> | null = null

function readEntry<T>(key: string, value: unknown, parser: CacheParser<T>): CacheEntry<T> | null {
  if (value === undefined) return null
  try {
    const entry = entrySchema.parse(value)
    if (entry.timestamp > Date.now()) throw new Error('Cache timestamp is in the future')
    return { data: parser.parse(entry.data), timestamp: entry.timestamp }
  } catch {
    console.warn('[Cache] Ignoring invalid entry', key)
    return null
  }
}

export function getCached<T>(key: string, parser: CacheParser<T>, ttl = DEFAULT_TTL): T | null {
  const entry = readEntry(key, MEMORY_CACHE.get(key), parser)
  if (!entry || Date.now() - entry.timestamp > ttl) return null
  return entry.data
}

export function setCached<T>(key: string, data: unknown, parser: CacheParser<T>): T {
  const parsed = parser.parse(data)
  const entry = { data: parsed, timestamp: Date.now() }
  MEMORY_CACHE.set(key, entry)
  void persist(key, entry)
  return parsed
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'))
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); dbPromise = null }
      resolve(db)
    }
    request.onerror = () => { dbPromise = null; reject(request.error) }
    request.onblocked = () => console.warn('[Cache] IndexedDB upgrade blocked')
  })
  return dbPromise
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Cache transaction aborted'))
  })
}

async function persist(key: string, entry: CacheEntry<unknown>): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(STORE_NAME).put(entry, key)
    await done
  } catch {
    console.warn('[Cache] Persistence unavailable; using memory only', key)
  }
}

async function readPersisted<T>(key: string, parser: CacheParser<T>): Promise<CacheEntry<T> | null> {
  try {
    const db = await openDB()
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
    const result = await new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return readEntry(key, result, parser)
  } catch {
    console.warn('[Cache] Persistent read unavailable; fetching current data', key)
    return null
  }
}

async function refresh<T>(key: string, fetcher: () => Promise<unknown>, parser: CacheParser<T>): Promise<T> {
  const pending = IN_FLIGHT.get(key)
  if (pending) return parser.parse(await pending)
  const promise = Promise.resolve().then(fetcher).then(data => setCached(key, data, parser))
  IN_FLIGHT.set(key, promise)
  try {
    return await promise
  } finally {
    IN_FLIGHT.delete(key)
  }
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<unknown>,
  parser: CacheParser<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const memory = readEntry(key, MEMORY_CACHE.get(key), parser)
  if (memory && Date.now() - memory.timestamp <= ttl) return memory.data
  const persisted = await readPersisted(key, parser)
  const entry = persisted && (!memory || persisted.timestamp > memory.timestamp) ? persisted : memory
  if (entry) {
    // Retain the original age: failed revalidation must not make stale data fresh.
    MEMORY_CACHE.set(key, entry)
    if (Date.now() - entry.timestamp > ttl) {
      void refresh(key, fetcher, parser).catch(() => console.error('[Cache] Background refresh failed', key))
    }
    return entry.data
  }
  return refresh(key, fetcher, parser)
}

export function revalidateCache<T>(
  key: string,
  fetcher: () => Promise<unknown>,
  parser: CacheParser<T>,
): void {
  void refresh(key, fetcher, parser).catch(() => console.error('[Cache] Revalidation failed', key))
}

export function prefetch<T>(
  key: string,
  fetcher: () => Promise<unknown>,
  parser: CacheParser<T>,
  ttl = DEFAULT_TTL,
): void {
  if (getCached(key, parser, ttl) !== null) return
  void fetchWithCache(key, fetcher, parser, ttl).catch(() => console.error('[Cache] Prefetch failed', key))
}

export function prefetchAll(
  items: Array<{ key: string; fetcher: () => Promise<unknown>; parser: CacheParser<unknown>; ttl?: number }>,
): void {
  items.forEach(({ key, fetcher, parser, ttl }) => prefetch(key, fetcher, parser, ttl))
}

export async function getFromCache<T>(key: string, parser: CacheParser<T>, ttl = DEFAULT_TTL): Promise<T | null> {
  const memory = getCached(key, parser, ttl)
  if (memory !== null) return memory
  const entry = await readPersisted(key, parser)
  if (!entry || Date.now() - entry.timestamp > ttl) return null
  MEMORY_CACHE.set(key, entry)
  return entry.data
}

export async function clearCache(key: string): Promise<void> {
  MEMORY_CACHE.delete(key)
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(STORE_NAME).delete(key)
    await done
  } catch {
    console.warn('[Cache] Persistent deletion failed', key)
    throw new Error('Persistent cache could not be cleared')
  }
}
