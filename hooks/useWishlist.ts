"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"

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
}

const wishlistCache = new Map<string, WishlistItem[]>()
const wishlistRequests = new Map<string, Promise<WishlistItem[]>>()

async function loadWishlist(userId: string, force = false): Promise<WishlistItem[]> {
  if (!force && wishlistCache.has(userId)) return wishlistCache.get(userId) || []
  if (!force && wishlistRequests.has(userId)) return wishlistRequests.get(userId) || []

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
  const { user } = useAuth()

  const fetchWishlist = useCallback(async (force = false) => {
    // If AuthContext hasn't hydrated yet, try reading a stored user from localStorage.
    let userId = user?.id
    if (!userId) {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("user") : null
        if (stored) {
          const parsed = JSON.parse(stored)
          userId = parsed?.id
        }
      } catch (e) {
        console.debug("No fallback user in localStorage", e)
      }
    }

    if (!userId) {
      setWishlist([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const items = await loadWishlist(userId, force)
    setWishlist(items)
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const addToWishlist = async (productId: string) => {
    if (!user) {
      toast.error("Please login to add items to your wishlist")
      return false
    }

    try {
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

      if (data.added) {
        toast.success("Added to wishlist")
        fetchWishlist(true) // Refresh wishlist
        return true
      } else {
        toast.success("Item already in wishlist")
        return false
      }
    } catch (error) {
      console.error("Error adding to wishlist:", error)
      toast.error("Failed to add to wishlist")
      return false
    }
  }

  const removeFromWishlist = async (productId: string) => {
    if (!user) return false

    try {
      const response = await fetch(`/api/wishlist?productId=${productId}`, {
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
      fetchWishlist(true) // Refresh wishlist
      return true
    } catch (error) {
      console.error("Error removing from wishlist:", error)
      toast.error("Failed to remove from wishlist")
      return false
    }
  }

  const isInWishlist = (productId: string) => {
    return wishlist.some((item) => item.id === productId)
  }

  return {
    wishlist,
    isLoading,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    refreshWishlist: fetchWishlist,
  }
}
