"use client"

import { apiFetchJson } from "@/lib/api-client"
import { StoreBusinessResponseSchema, type StoreBusiness } from "@/lib/store-business-types"

const cache = new Map<string, { expires: number; promise: Promise<StoreBusiness> }>()
export function getStoreBusiness(id: string, refresh = false): Promise<StoreBusiness> {
  const entry = cache.get(id)
  if (!refresh && entry && entry.expires > Date.now()) return entry.promise
  const promise = apiFetchJson(`/api/stores/${encodeURIComponent(id)}/business`, { signal: AbortSignal.timeout(35000) }, value => StoreBusinessResponseSchema.parse(value))
    .then(data => data.business)
  cache.set(id, { expires: Date.now() + 5 * 60000, promise })
  void promise.catch(() => { if (cache.get(id)?.promise === promise) cache.delete(id) })
  return promise
}
