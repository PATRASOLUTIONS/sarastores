"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"
import { z } from "zod"

export interface WishlistItem {
  id: string
  name: string
  price: number
  image?: string
  description?: string
  category?: string
  slug?: string
  sku?: string
  SKU?: string
  skuNo?: string
  discount?: number
  rating?: number
  reviews?: number
  type?: "hardware" | "software"
}

const wishlistCache = new Map<string, WishlistItem[]>()
const wishlistRequests = new Map<string, Promise<WishlistItem[]>>()
const GUEST_WISHLIST_KEY = "wishlist_guest"
const guestItemSchema = z.object({
  id: z.string().min(1), name: z.string(), price: z.number().finite().nonnegative(),
  image: z.string().optional(), type: z.enum(["hardware", "software"]).optional(),
}).passthrough()

function readGuestWishlist(): WishlistItem[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(GUEST_WISHLIST_KEY) || "[]")
    if (!Array.isArray(stored)) return []
    const items = stored.flatMap(item => {
      const parsed = guestItemSchema.safeParse(item)
      return parsed.success ? [parsed.data as WishlistItem] : []
    })
    return [...new Map(items.map(item => [item.id, item])).values()]
  } catch { return [] }
}

function saveGuestWishlist(items: WishlistItem[]) {
  localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event("wishlist-updated"))
}

async function loadWishlist(userId: string, force = false): Promise<WishlistItem[]> {
  if (wishlistRequests.has(userId)) return wishlistRequests.get(userId) || []
  if (!force && wishlistCache.has(userId)) return wishlistCache.get(userId) || []

  const request = fetch("/api/wishlist", { credentials: "include" })
    .then(async response => {
      if (response.status === 401) return []
      if (!response.ok) throw new Error(`Wishlist request failed with status ${response.status}`)
      const data = await response.json()
      return Array.isArray(data.items) ? data.items : []
    })
    .then(items => {
      wishlistCache.set(userId, items)
      return items
    })
    .catch(error => {
      console.error("Error fetching wishlist:", error)
      return wishlistCache.get(userId) || []
    })
    .finally(() => {
      wishlistRequests.delete(userId)
    })

  wishlistRequests.set(userId, request)
  return request
}

export function useWishlist() {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user, isLoading: authLoading } = useAuth()
  const owner = user?.id || "guest"
  const activeOwner = useRef(owner)
  activeOwner.current = owner
  const fetchVersion = useRef(0)
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null)

  const fetchWishlist = useCallback(async (force = false) => {
    if (authLoading) return
    const version = ++fetchVersion.current
    setIsLoading(true)
    const items = owner === "guest" ? readGuestWishlist() : await loadWishlist(owner, force)
    if (activeOwner.current !== owner || version !== fetchVersion.current) return
    setWishlist(items)
    setLoadedOwner(owner)
    setIsLoading(false)
  }, [owner, authLoading])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])
  useEffect(() => {
    const refresh = () => { void fetchWishlist(true) }
    const onStorage = (event: StorageEvent) => {
      if (event.key === GUEST_WISHLIST_KEY || event.key === "wishlist-updated-at") refresh()
    }
    window.addEventListener("wishlist-updated", refresh)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("wishlist-updated", refresh)
      window.removeEventListener("storage", onStorage)
      fetchVersion.current++
    }
  }, [fetchWishlist])

  const addToWishlist = async (productId: string, product?: WishlistItem) => {
    if (authLoading) return false
    try {
      if (!user) {
        if (readGuestWishlist().some(item => item.id === productId)) {
          toast.success("Item already in wishlist")
          return true
        }
        let item = product
        if (!item) {
          let type: "hardware" | "software" = "hardware"
          let response = await fetch(`/api/products/${encodeURIComponent(productId)}`)
          if (response.status === 404) {
            type = "software"
            response = await fetch(`/api/software/${encodeURIComponent(productId)}`)
          }
          if (!response.ok) throw new Error("Product could not be saved")
          const data = await response.json()
          const parsed = guestItemSchema.safeParse({ ...(data.product || data), id: productId, type })
          if (!parsed.success) throw new Error("Product could not be saved")
          item = parsed.data as WishlistItem
        }
        if (activeOwner.current !== "guest") return false
        const current = readGuestWishlist()
        saveGuestWishlist([...current.filter(existing => existing.id !== productId), { ...item, id: productId }])
        toast.success("Added to wishlist")
        return true
      }
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      })

      if (response.status === 401) {
        // Global handler will toast + clear the stale user state.
        return false
      }

      if (!response.ok) {
        throw new Error("Failed to add to wishlist")
      }

      const data = await response.json()
      await wishlistRequests.get(owner)
      wishlistCache.delete(owner)
      window.dispatchEvent(new Event("wishlist-updated"))
      try { localStorage.setItem("wishlist-updated-at", String(Date.now())) } catch { /* Same-tab updates still work. */ }
      toast.success(data.added ? "Added to wishlist" : "Item already in wishlist")
      return true
    } catch (error) {
      console.error("Error adding to wishlist:", error)
      toast.error("Failed to add to wishlist")
      return false
    }
  }

  const removeFromWishlist = async (productId: string) => {
    if (authLoading) return false
    try {
      if (!user) {
        saveGuestWishlist(readGuestWishlist().filter(item => item.id !== productId))
        toast.success("Removed from wishlist")
        return true
      }
      const response = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
        method: "DELETE",
      })

      if (response.status === 401) {
        // Global handler will toast + clear the stale user state.
        return false
      }

      if (!response.ok) {
        throw new Error("Failed to remove from wishlist")
      }

      toast.success("Removed from wishlist")
      await wishlistRequests.get(owner)
      wishlistCache.delete(owner)
      window.dispatchEvent(new Event("wishlist-updated"))
      try { localStorage.setItem("wishlist-updated-at", String(Date.now())) } catch { /* Same-tab updates still work. */ }
      return true
    } catch (error) {
      console.error("Error removing from wishlist:", error)
      toast.error("Failed to remove from wishlist")
      return false
    }
  }

  const isInWishlist = (productId: string) => {
    return loadedOwner === owner && wishlist.some((item) => item.id === productId)
  }

  return {
    wishlist: loadedOwner === owner && !authLoading ? wishlist : [],
    isLoading: isLoading || authLoading || loadedOwner !== owner,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    refreshWishlist: fetchWishlist,
  }
}
