"use client"

import { useEffect, useState, useRef } from "react"

const STORAGE_KEY = "compare_products"
const MAX_STORAGE_SIZE = 5000 // 5KB limit for compare data
const MAX_COMPARE_ITEMS = 6 // Maximum 6 products to compare

export function useCompare() {
  const [compareIds, setCompareIds] = useState<string[]>([])
  const instanceId = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const compareRef = useRef<string[]>(compareIds)
  useEffect(() => {
    compareRef.current = compareIds
  }, [compareIds])

  const initialLoaded = useRef(false)

  // Extract only the ID from complex objects, ensure minimal storage
  const normalizeIds = (input: any): string[] => {
    if (!input) return []
    try {
      const arr = Array.isArray(input) ? input : [input]
      const ids: string[] = []
      arr.forEach((item) => {
        if (item === null || item === undefined) return
        // Only extract simple string IDs, reject large objects
        if (typeof item === "string") {
          const s = item.trim()
          // Only accept reasonable length IDs (max 100 chars)
          if (s && s.length < 100) ids.push(s)
          return
        }
        if (typeof item === "number") {
          ids.push(String(item))
          return
        }
        if (typeof item === "object") {
          try {
            // Only extract id/_id, ignore rest of the object
            if (item.id && typeof item.id === "string") {
              const s = String(item.id).trim()
              if (s && s.length < 100) ids.push(s)
              return
            }
            if (item._id && typeof item._id === "string") {
              const s = item._id.trim()
              if (s && s.length < 100) ids.push(s)
              return
            }
            if ((item._id as any)?.$oid) {
              const s = String((item._id as any).$oid).trim()
              if (s && s.length < 100) ids.push(s)
              return
            }
          } catch (e) {
            // ignore
          }
        }
      })
      return Array.from(new Set(ids)).slice(0, MAX_COMPARE_ITEMS)
    } catch (e) {
      return []
    }
  }

  // Clean up old/corrupted localStorage data
  const cleanupOldData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const size = new Blob([raw]).size
        // If stored data is suspiciously large (> 5KB), try to salvage IDs before clearing
        if (size > MAX_STORAGE_SIZE) {
          try {
            const parsed = JSON.parse(raw)
            const candidate = Array.isArray(parsed)
              ? parsed
              : (parsed && Array.isArray(parsed.ids))
              ? parsed.ids
              : (parsed && Array.isArray(parsed.items))
              ? parsed.items
              : parsed
            const salvaged = normalizeIds(candidate)
            if (salvaged && salvaged.length > 0) {
              // store minimal normalized IDs back to localStorage
              localStorage.setItem(STORAGE_KEY, JSON.stringify(salvaged))
              console.warn("[useCompare] Salvaged compare IDs from oversized storage and compacted them")
              return
            }
          } catch (e) {
            // fallthrough to remove
          }

          localStorage.removeItem(STORAGE_KEY)
          console.warn("[useCompare] Cleared oversized compare data to fix 431 error")
        }
      }
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    try {
      cleanupOldData()
      const raw = localStorage.getItem(STORAGE_KEY)
      if (process.env.NODE_ENV !== "production") {
        try {
          console.debug("[useCompare] raw localStorage value:", raw)
        } catch (e) {
          // ignore
        }
      }
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          // Accept multiple legacy shapes: array, { ids: [...] }, { items: [...] }
          const candidate = Array.isArray(parsed)
            ? parsed
            : (parsed && Array.isArray(parsed.ids))
            ? parsed.ids
            : (parsed && Array.isArray(parsed.items))
            ? parsed.items
            : parsed

          const normalized = normalizeIds(candidate)
          if (normalized.length) setCompareIds(normalized)
        } catch (e) {
          // ignore malformed localStorage
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch (e) {
      setCompareIds([])
    }
    initialLoaded.current = true
  }, [])

  useEffect(() => {
    if (!initialLoaded.current) return
    try {
      // Store ONLY the IDs array - minimal footprint
      const rawToStore = JSON.stringify(compareIds)
      const size = new Blob([rawToStore]).size
      
      // Safety check: don't store if it exceeds size limit
      if (size > MAX_STORAGE_SIZE) {
        console.warn("[useCompare] Compare data exceeds size limit, clearing", { size, ids: compareIds })
        localStorage.removeItem(STORAGE_KEY)
        setCompareIds((prev) => prev.slice(0, MAX_COMPARE_ITEMS))
        return
      }
      
      localStorage.setItem(STORAGE_KEY, rawToStore)
      if (process.env.NODE_ENV !== "production") console.debug("[useCompare] writing to localStorage:", rawToStore)
    } catch (e) {
      // ignore
    }
    try {
      const detail = { ids: compareIds, source: instanceId.current }
      window.dispatchEvent(new CustomEvent("compare_products_updated", { detail }))
      if (process.env.NODE_ENV !== "production") console.debug("[useCompare] dispatched compare_products_updated", detail)
    } catch (e) {
      // ignore
    }
  }, [compareIds])

  useEffect(() => {
    const onCustom = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail
        if (process.env.NODE_ENV !== "production") console.debug("[useCompare] received custom event detail:", detail)
        if (!detail) return
        const source = detail && detail.source
        const incoming = Array.isArray(detail.ids) ? detail.ids : Array.isArray(detail) ? detail : []
        if (source && source === instanceId.current) return
        const normalized = normalizeIds(incoming)
        if (JSON.stringify(normalized) !== JSON.stringify(compareRef.current)) {
          setCompareIds(normalized)
        }
      } catch (err) {
        // ignore
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (process.env.NODE_ENV !== "production") console.debug("[useCompare] storage event", e)
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : []
          const candidate = Array.isArray(parsed)
            ? parsed
            : (parsed && Array.isArray(parsed.ids))
            ? parsed.ids
            : (parsed && Array.isArray(parsed.items))
            ? parsed.items
            : parsed
          const normalized = normalizeIds(candidate)
          if (normalized.length) {
            if (JSON.stringify(normalized) !== JSON.stringify(compareRef.current)) setCompareIds(normalized)
          } else if (compareRef.current.length !== 0) {
            setCompareIds([])
          }
        } catch (err) {
          // ignore
        }
      }
    }

    window.addEventListener("compare_products_updated", onCustom as EventListener)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("compare_products_updated", onCustom as EventListener)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const addToCompare = (idOrItem: any) => {
    // Accept string ids, numbers, or product-like objects and normalize to an ID
    const ids = normalizeIds(idOrItem)
    if (!ids || ids.length === 0) {
      if (process.env.NODE_ENV !== "production") console.debug("[useCompare] addToCompare rejected input", idOrItem)
      return
    }
    const sid = String(ids[0]).trim()
    if (!sid) return
    if (process.env.NODE_ENV !== "production") console.debug("[useCompare] addToCompare called with:", idOrItem)
    setCompareIds((prev) => {
      if (prev.includes(sid)) return prev
      const next = [...prev, sid].slice(0, MAX_COMPARE_ITEMS)
      if (process.env.NODE_ENV !== "production") console.debug("[useCompare] addToCompare next:", next)
      return next
    })
  }

  const removeFromCompare = (idOrItem: any) => {
    const ids = normalizeIds(idOrItem)
    const sid = ids && ids.length ? String(ids[0]).trim() : String(idOrItem || "").trim()
    if (!sid) return
    if (process.env.NODE_ENV !== "production") console.debug("[useCompare] removeFromCompare called with:", idOrItem)
    setCompareIds((prev) => prev.filter((x) => x !== sid))
  }

  const clearCompare = () => setCompareIds([])

  const isInCompare = (idOrItem: any) => {
    if (!idOrItem) return false
    const ids = normalizeIds(idOrItem)
    const sid = ids && ids.length ? String(ids[0]).trim() : String(idOrItem).trim()
    return compareIds.includes(sid)
  }

  return { compareIds, addToCompare, removeFromCompare, clearCompare, isInCompare }
}
