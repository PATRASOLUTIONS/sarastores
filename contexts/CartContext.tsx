"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/contexts/AuthContext"
import { analytics, toAnalyticsItem } from "@/lib/analytics"
import { toast } from "react-hot-toast"

export interface CartItem {
  color: string | null
  size: string | null
  id: string
  name: string
  price: number
  image: string
  quantity: number
  type?: "software" | "hardware"
  packSize?: number
  validityYears?: number
  maxDevices?: number | string
  validity?: string
  deviceType?: string
  licenseKey?: string
  activationDate?: string | Date
  expiryDate?: string | Date
}

export interface Address {
  name?: string
  street: string
  city: string
  state: string
  zip: string
  country: string
}

export interface Order {
  id: string
  userId: string
  items: CartItem[]
  total: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  shippingAddress: Address
  paymentMethod: string
  createdAt: string
}

type CartContextValue = {
  cart: CartItem[]
  isLoading: boolean
  addToCart: (product: CartItem) => Promise<void>
  updateQuantity: (id: string, quantity: number) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  saveOrder: (order: Omit<Order, "id" | "createdAt">) => Promise<Order>
  getOrders: () => Promise<Order[]>
  getOrder: (orderId: string) => Promise<Order | undefined>
  syncCartWithDatabase: () => Promise<void>
  loadCartFromDatabase: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

const EMPTY_CART: CartItem[] = []

/**
 * Single source of truth for the cart, shared by every `useCart()` consumer
 * (Header, CartSidebar, CartQuickAccess, AddToCartButton, product page, cart
 * page, dashboard, checkout, etc.).
 *
 * Why this exists: the previous design had each consumer instantiate its own
 * `cart` state and its own `loadCart` effect, so 15 components × 1 GET each
 * on every mount / user-ref change produced the "/api/cart called again and
 * again" symptom — and the racing GETs could briefly observe an empty server
 * cart, then overwrite the in-memory cart with `[]`, producing the
 * "cart appears empty after a few minutes" symptom.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  return <CartProviderInner>{children}</CartProviderInner>
}

export function CartProviderInner({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id || "guest"

  const [cart, setCartState] = useState<CartItem[]>(EMPTY_CART)
  const [isLoading, setIsLoading] = useState(true)

  // Track which userId we have already loaded for. Prevents the
  // `[userId, user]` effect-dep instability from re-fetching when the
  // user *object* changes reference (e.g. AuthContext profile refresh)
  // but the *id* is unchanged.
  const loadedForUserIdRef = useRef<string | null>(null)

  // Single in-flight load promise, shared by every consumer mount that
  // happens to call `loadCartFromDatabase` for the same userId.
  const loadPromiseRef = useRef<Promise<void> | null>(null)

  // Debounce timer for the `cart` -> server sync effect.
  const cartUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // `isMounted` keeps late-arriving fetches from clobbering state after a
  // provider unmount (e.g. HMR, route transitions).
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (cartUpdateTimeoutRef.current) {
        clearTimeout(cartUpdateTimeoutRef.current)
      }
    }
  }, [])

  // ----- helpers -----------------------------------------------------------

  const safeSetCart = useCallback((next: CartItem[]) => {
    setCartState((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev
      return next
    })
  }, [])

  const persistLocal = useCallback(
    (next: CartItem[]) => {
      try {
        localStorage.setItem(`cart_${userId}`, JSON.stringify(next))
        window.dispatchEvent(new Event("cart-updated"))
      } catch {
        // localStorage write failure — non-fatal
      }
    },
    [userId],
  )

  // ----- single loader -----------------------------------------------------

  const loadCartFromDatabase = useCallback(async (): Promise<void> => {
    // Guard: must have a real userId to load (not "guest", not null)
    if (!user?.id || user.id === "guest") {
      // Guest: read whatever the previous guest session left in localStorage.
      if (isMountedRef.current) {
        try {
          const saved = localStorage.getItem(`cart_${userId}`)
          if (saved) {
            const parsed = JSON.parse(saved)
            if (Array.isArray(parsed)) safeSetCart(parsed)
          }
        } catch {
          // ignore parse error
        }
        setIsLoading(false)
      }
      return
    }

    // Dedup: if a load is already in-flight for this userId, await it.
    if (loadPromiseRef.current) {
      return loadPromiseRef.current
    }

    // Capture userId at load time — avoids stale closures when `user`
    // reference changes due to focus/visibility syncs.
    const currentUserId = user.id

    // Anything the visitor added while logged out is folded into the account
    // cart on first authenticated load, then the guest copy is discarded.
    let guestItems: CartItem[] = []
    try {
      const guestSaved = localStorage.getItem("cart_guest")
      if (guestSaved) {
        const parsed = JSON.parse(guestSaved)
        if (Array.isArray(parsed)) guestItems = parsed
      }
    } catch {
      // ignore parse error
    }

    const mergeGuest = (serverItems: CartItem[]): CartItem[] => {
      if (guestItems.length === 0) return serverItems
      const merged = [...serverItems]
      for (const g of guestItems) {
        const i = merged.findIndex((item) => item.id === g.id)
        if (i >= 0) {
          merged[i] = { ...merged[i], quantity: (merged[i].quantity || 1) + (g.quantity || 1) }
        } else {
          merged.push(g)
        }
      }
      try {
        localStorage.removeItem("cart_guest")
      } catch {
        // ignore
      }
      return merged
    }

    const promise = (async () => {
      if (isMountedRef.current) setIsLoading(true)
      try {
        const res = await fetch(`/api/cart?userId=${currentUserId}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        })

        if (res.status === 401) {
          // Session expired — fall back to localStorage, stay quiet.
          if (isMountedRef.current) {
            try {
              const saved = localStorage.getItem(`cart_${userId}`)
              if (saved) {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length > 0) safeSetCart(parsed)
              }
            } catch {
              // ignore
            }
          }
          return
        }

        if (!res.ok) {
          // Non-401 error — keep whatever we already have.
          return
        }

        const data = await res.json().catch(() => null)

        if (isMountedRef.current && data && Array.isArray(data.items) && data.items.length > 0) {
          // Server has authoritative data — adopt it, folding in any guest cart.
          const merged = mergeGuest(data.items)
          safeSetCart(merged)
          persistLocal(merged)
          if (merged.length !== data.items.length || guestItems.length > 0) {
            fetch("/api/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: currentUserId, items: merged }),
            }).catch(() => {
              // network error — localStorage is primary
            })
          }
        } else if (
          isMountedRef.current &&
          data &&
          Array.isArray(data.items) &&
          data.items.length === 0
        ) {
          // EMPTY-OVERWRITE GUARD:
          // The server says empty. Before we wipe the in-memory cart, check
          // localStorage — if the user has items locally that we haven't
          // successfully synced yet, restore them and push them back up.
          // This is the fix for "cart appears empty after a few minutes":
          // a racing GET could observe an empty server and clobber state.
          try {
            const saved = localStorage.getItem(`cart_${userId}`)
            if (saved) {
              const parsed = JSON.parse(saved)
              if (Array.isArray(parsed) && parsed.length > 0) {
                const merged = mergeGuest(parsed)
                safeSetCart(merged)
                // Push the local cart back to the server so future GETs
                // see it. Best-effort, fire-and-forget.
                fetch("/api/cart", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: currentUserId, items: merged }),
                }).catch(() => {
                  // network error — localStorage is primary
                })
                return
              }
            }
            // Server empty and no local cart — adopt the guest cart if present.
            if (guestItems.length > 0) {
              const merged = mergeGuest([])
              safeSetCart(merged)
              persistLocal(merged)
              fetch("/api/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: currentUserId, items: merged }),
              }).catch(() => {
                // network error — localStorage is primary
              })
              return
            }
            // Both server and localStorage empty — clear local copy.
            safeSetCart([])
            localStorage.removeItem(`cart_${userId}`)
          } catch {
            // ignore parse error
          }
        }
      } catch {
        // Network error — keep existing state.
      } finally {
        if (isMountedRef.current) setIsLoading(false)
      }
    })()

    loadPromiseRef.current = promise
    try {
      await promise
    } finally {
      loadPromiseRef.current = null
    }
  }, [persistLocal, safeSetCart, userId])

  // ----- mount-time load (once per userId) ---------------------------------

  useEffect(() => {
    // Always skip re-load if no user (keep local data, don't blast the network).
    // The userId="guest" case is handled by the loadCartFromDatabase early-return
    // for guests — we never want to replace a logged-in user's cart with nothing.
    if (!user || userId === "guest") {
      setIsLoading(false)
      return
    }

    // Skip if we already loaded (or attempted to load) for this userId.
    // This is the core fix for the spam: the auth `user` object reference
    // can churn (focus/visibility sync, profile refresh), but the userId
    // only changes on actual login/logout.
    if (loadedForUserIdRef.current === userId) {
      // On remount of the *same* user, just re-hydrate from localStorage
      // for instant paint and don't hit the network.
      try {
        const saved = localStorage.getItem(`cart_${userId}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            safeSetCart(parsed)
            setIsLoading(false)
            return
          }
        }
      } catch {
        // ignore
      }
      setIsLoading(false)
      return
    }

    loadedForUserIdRef.current = userId
    loadCartFromDatabase()
  }, [loadCartFromDatabase, safeSetCart, user, userId])

  // When userId changes, reset the dedup guard so the next mount can load.
  useEffect(() => {
    return () => {
      // No-op: the next effect run will reset the ref if userId changed.
    }
  }, [userId])

  // ----- actions -----------------------------------------------------------

  const removeFromCart = useCallback(
    (id: string) => {
      setCartState((prev) => {
        const removed = prev.find((item) => item.id === id)
        if (removed) analytics.removeFromCart(toAnalyticsItem(removed))
        const next = prev.filter((item) => item.id !== id)
        persistLocal(next)
        return next
      })
    },
    [persistLocal],
  )

  const addToCart = useCallback(
    async (product: CartItem) => {
      // Guests keep their cart in localStorage under `cart_guest`; it is merged
      // into the account cart on login. Forcing login here was the single
      // largest drop-off in the funnel.
      let updatedCart: CartItem[] = []

      setCartState((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === product.id)
        let next: CartItem[]
        if (existingIndex >= 0) {
          next = [...prev]
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: (next[existingIndex].quantity || 1) + (product.quantity || 1),
            ...(product.type && { type: product.type }),
            ...(product.packSize && { packSize: product.packSize }),
            ...(product.validityYears && { validityYears: product.validityYears }),
            ...(product.maxDevices !== undefined && { maxDevices: product.maxDevices }),
            ...(product.validity !== undefined && { validity: product.validity }),
            ...(product.deviceType && { deviceType: product.deviceType }),
          }
        } else {
          next = [
            ...prev,
            {
              ...product,
              quantity: product.quantity || 1,
              type: product.type || "hardware",
              price: Number(product.price) || 0,
              ...(product.maxDevices !== undefined && { maxDevices: product.maxDevices }),
              ...(product.validity !== undefined && { validity: product.validity }),
            },
          ]
        }
        persistLocal(next)
        updatedCart = next
        return next
      })

      if (user?.id && user.id !== "guest") {
        try {
          await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, items: updatedCart }),
          })
        } catch {
          // network error — localStorage is the primary fallback
        }
      }

      analytics.addToCart(toAnalyticsItem(product, product.quantity || 1))
    },
    [persistLocal, user],
  )

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(id)
        return
      }
      setCartState((prev) => {
        const next = prev.map((item) => (item.id === id ? { ...item, quantity } : item))
        persistLocal(next)
        return next
      })
    },
    [persistLocal, removeFromCart],
  )

  const clearCart = useCallback(() => {
    setCartState([])
    persistLocal([])
  }, [persistLocal])

  const syncCartWithDatabase = useCallback(async () => {
    if (!user || user.id === "guest") return
    let snapshot: CartItem[] = []
    setCartState((prev) => {
      snapshot = prev
      return prev
    })
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, items: snapshot }),
      })
    } catch {
      // network error — localStorage is primary
    }
  }, [user])

  // ----- cart -> server debounced sync -------------------------------------

  useEffect(() => {
    // Skip until the initial load has completed — otherwise the first
    // paint would immediately re-POST the server's own data back to it.
    if (isLoading) return

    if (cartUpdateTimeoutRef.current) {
      clearTimeout(cartUpdateTimeoutRef.current)
    }
    cartUpdateTimeoutRef.current = setTimeout(() => {
      syncCartWithDatabase()
    }, 500)

    return () => {
      if (cartUpdateTimeoutRef.current) {
        clearTimeout(cartUpdateTimeoutRef.current)
        cartUpdateTimeoutRef.current = null
      }
    }
  }, [cart, isLoading, syncCartWithDatabase])

  // ----- cross-tab sync ----------------------------------------------------

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `cart_${userId}`) {
        try {
          const latest = localStorage.getItem(`cart_${userId}`)
          if (!latest) return
          const parsed = JSON.parse(latest)
          if (Array.isArray(parsed)) safeSetCart(parsed)
        } catch {
          // ignore
        }
      }
    }
    const onCartUpdated = () => {
      try {
        const latest = localStorage.getItem(`cart_${userId}`)
        if (!latest) return
        const parsed = JSON.parse(latest)
        if (Array.isArray(parsed)) safeSetCart(parsed)
      } catch {
        // ignore
      }
    }
    window.addEventListener("storage", onStorage as EventListener)
    window.addEventListener("cart-updated", onCartUpdated)
    return () => {
      window.removeEventListener("storage", onStorage as EventListener)
      window.removeEventListener("cart-updated", onCartUpdated)
    }
  }, [safeSetCart, userId])

  // ----- orders (unchanged API) --------------------------------------------

  const saveOrder = useCallback(
    async (order: Omit<Order, "id" | "createdAt">) => {
      const newOrder: Order = {
        ...order,
        id: `order_${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
      try {
        if (user && user.id !== "guest") {
          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newOrder),
          })
          if (res.status === 401) {
            const ordersJson = localStorage.getItem(`orders_${userId}`) || "[]"
            const orders = JSON.parse(ordersJson)
            orders.push(newOrder)
            localStorage.setItem(`orders_${userId}`, JSON.stringify(orders))
            return newOrder
          }
          if (!res.ok) throw new Error("Failed to save order")
          return await res.json()
        } else {
          const ordersJson = localStorage.getItem(`orders_${userId}`) || "[]"
          const orders = JSON.parse(ordersJson)
          orders.push(newOrder)
          localStorage.setItem(`orders_${userId}`, JSON.stringify(orders))
          return newOrder
        }
      } catch (error) {
        toast.error("Error saving your order")
        throw error
      }
    },
    [user, userId],
  )

  const getOrders = useCallback(async (): Promise<Order[]> => {
    try {
      if (user && user.id !== "guest") {
        const response = await fetch(`/api/orders?userId=${user.id}`)
        if (response.status === 401) {
          const ordersJson = localStorage.getItem(`orders_${userId}`) || "[]"
          return JSON.parse(ordersJson)
        }
        if (!response.ok) throw new Error("Failed to fetch orders")
        return await response.json()
      } else {
        const ordersJson = localStorage.getItem(`orders_${userId}`) || "[]"
        return JSON.parse(ordersJson)
      }
    } catch {
      toast.error("Error loading your orders")
      return []
    }
  }, [user, userId])

  const getOrder = useCallback(
    async (orderId: string): Promise<Order | undefined> => {
      try {
        if (user && user.id !== "guest") {
          const response = await fetch(`/api/orders/${orderId}`)
          if (response.status === 401) {
            const orders = await getOrders()
            return orders.find((order) => order.id === orderId)
          }
          if (!response.ok) throw new Error("Failed to fetch order")
          return await response.json()
        } else {
          const orders = await getOrders()
          return orders.find((order) => order.id === orderId)
        }
      } catch {
        toast.error("Error loading order details")
        return undefined
      }
    },
    [getOrders, user],
  )

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isLoading,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      saveOrder,
      getOrders,
      getOrder,
      syncCartWithDatabase,
      loadCartFromDatabase,
    }),
    [
      cart,
      isLoading,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      saveOrder,
      getOrders,
      getOrder,
      syncCartWithDatabase,
      loadCartFromDatabase,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCartContext(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error("useCartContext must be used within a CartProvider")
  }
  return ctx
}