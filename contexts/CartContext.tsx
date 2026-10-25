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
import { cartLimitError } from "@/lib/cart-limits"
import { CHECKOUT_CART_INTENT, CHECKOUT_CART_SELECTION_ID, mergeCheckoutCart } from "@/lib/checkout-cart"
import { usePathname } from "next/navigation"

export interface CartItem {
  color: string | null
  size: string | null
  id: string
  name: string
  price: number
  image: string
  quantity: number
  stock?: number
  type?: "software" | "hardware"
  packSize?: number
  validityYears?: number
  maxDevices?: number | string
  validity?: string
  deviceType?: string
  licenseKey?: string
  activationDate?: string | Date
  expiryDate?: string | Date
  source?: string
  provider?: string
  kgenProductId?: string | null
  kgenVariantId?: string | null
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
  addToCart: (product: CartItem) => Promise<boolean>
  updateQuantity: (id: string, quantity: number) => boolean
  refreshItemPrices: (prices: Record<string, number>, stocks?: Record<string, number>) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  saveOrder: (order: Omit<Order, "id" | "createdAt">) => Promise<Order>
  getOrders: () => Promise<Order[]>
  getOrder: (orderId: string) => Promise<Order | undefined>
  syncCartWithDatabase: () => Promise<void>
  loadCartFromDatabase: () => Promise<void>
  checkoutCartPending: boolean
  previousCart: CartItem[]
  previousCartLoaded: boolean
  checkoutCartError: string
  resolvingCheckoutCart: boolean
  prepareCheckoutSignIn: () => boolean
  resolveCheckoutCart: (includePrevious: boolean) => Promise<boolean>
  abandonCheckoutCart: () => Promise<boolean>
}

const CartContext = createContext<CartContextValue | null>(null)

const EMPTY_CART: CartItem[] = []

async function keepPublicCartItems(items: CartItem[]): Promise<CartItem[]> {
  const productIds = [...new Set(items
    .filter(item => item.type !== "software")
    .map(item => item.id)
    .filter(Boolean))]
  if (productIds.length === 0) return items

  try {
    const response = await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: productIds }),
      cache: "no-store",
    })
    if (!response.ok) return items
    const products = await response.json()
    if (!Array.isArray(products)) return items
    const visibleIds = new Set(products
      .flatMap((product) => [product?.id, product?._id])
      .filter((id): id is string => typeof id === "string"))
    return items.filter(item => item.type === "software" || visibleIds.has(item.id))
  } catch {
    // Availability checks must fail open on a network error so an offline
    // shopper's cart is not erased. Checkout still validates server-side.
    return items
  }
}

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
  const { user, registerBeforeLogout } = useAuth()
  const pathname = usePathname()
  const userId = user?.id || "guest"

  const [cart, setCartState] = useState<CartItem[]>(EMPTY_CART)
  const cartRef = useRef(cart)
  cartRef.current = cart
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutCartPending, setCheckoutCartPending] = useState(false)
  const checkoutCartPendingRef = useRef(false)
  const [previousCart, setPreviousCart] = useState<CartItem[]>([])
  const previousCartRef = useRef<CartItem[]>([])
  const preservedCartRef = useRef<CartItem[]>([])
  const checkoutStageSavedRef = useRef(false)
  const [previousCartLoaded, setPreviousCartLoaded] = useState(false)
  const [checkoutCartError, setCheckoutCartError] = useState("")
  const [resolvingCheckoutCart, setResolvingCheckoutCart] = useState(false)
  const resolvingCheckoutCartRef = useRef(false)
  const activeUserIdRef = useRef(userId)
  activeUserIdRef.current = userId
  useEffect(() => {
    checkoutStageSavedRef.current = false
    preservedCartRef.current = []
    if (userId !== "guest") return
    checkoutCartPendingRef.current = false
    setCheckoutCartPending(false)
    previousCartRef.current = []
    setPreviousCart([])
    setPreviousCartLoaded(false)
    setCheckoutCartError("")
  }, [userId])

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
        const stored = checkoutCartPendingRef.current && checkoutStageSavedRef.current
          ? mergeCheckoutCart(next, previousCartRef.current) : next
        localStorage.setItem(`cart_${userId}`, JSON.stringify(stored))
        if (checkoutCartPendingRef.current) sessionStorage.setItem(CHECKOUT_CART_INTENT, JSON.stringify(next))
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
            if (!Array.isArray(parsed)) throw new Error("Invalid guest cart format")
            const visible = await keepPublicCartItems(parsed)
            safeSetCart(visible)
            persistLocal(visible)
          } else safeSetCart(EMPTY_CART)
        } catch (error) {
          console.error("[Cart] Guest cart could not be restored:", error)
          toast.error("Your saved cart could not be loaded")
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
    let checkoutItems: CartItem[] | null = null
    try {
      const stored = sessionStorage.getItem(CHECKOUT_CART_INTENT)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length && parsed.every(item => item &&
          typeof item.id === "string" && typeof item.name === "string" &&
          Number.isSafeInteger(item.quantity) && item.quantity > 0)) checkoutItems = parsed
      }
    } catch { /* A normal account-cart load still works without storage. */ }
    if (checkoutItems) {
      checkoutCartPendingRef.current = true
      setCheckoutCartPending(true)
      checkoutStageSavedRef.current = false
      setPreviousCartLoaded(false)
      setCheckoutCartError("")
      safeSetCart(checkoutItems)
    }

    // Anything the visitor added while logged out is folded into the account
    // cart on first authenticated load, then the guest copy is discarded.
    let guestItems: CartItem[] = []
    try {
      const guestSaved = localStorage.getItem("cart_guest")
      if (guestSaved && !checkoutItems) {
        const parsed = JSON.parse(guestSaved)
        if (Array.isArray(parsed)) guestItems = await keepPublicCartItems(parsed)
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
        let requestBody: string | undefined
        if (checkoutItems) {
          const requestId = sessionStorage.getItem(CHECKOUT_CART_SELECTION_ID) || crypto.randomUUID()
          sessionStorage.setItem(CHECKOUT_CART_SELECTION_ID, requestId)
          requestBody = JSON.stringify({ requestId, action: "preserve", items: checkoutItems, previousItems: [] })
        }
        const res = await fetch(checkoutItems ? "/api/cart/checkout-selection" : "/api/cart", {
          method: checkoutItems ? "POST" : "GET",
          body: requestBody,
          credentials: "same-origin",
          keepalive: !!requestBody && new TextEncoder().encode(requestBody).byteLength < 60000,
          cache: "no-store",
          headers: {
            ...(checkoutItems ? { "Content-Type": "application/json" } : {}),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        })

        if (res.status === 401) {
          if (checkoutItems) {
            setCheckoutCartError("Sign in again to load your saved cart.")
            return
          }
          // Session expired — fall back to localStorage, stay quiet.
          if (isMountedRef.current) {
            try {
              const saved = localStorage.getItem(`cart_${userId}`)
              if (saved) {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const visible = await keepPublicCartItems(parsed)
                  safeSetCart(visible)
                  persistLocal(visible)
                }
              }
            } catch {
              // ignore
            }
          }
          return
        }

        if (!res.ok) {
          if (checkoutItems) setCheckoutCartError("Your saved cart could not be loaded. Please retry before paying.")
          // Non-401 error — keep whatever we already have.
          return
        }

        const data = await res.json().catch(() => null)

        if (checkoutItems) {
          if (!data?.success || !Array.isArray(data.items)) {
            setCheckoutCartError("Your saved cart could not be loaded. Please retry before paying.")
            return
          }
          if (!isMountedRef.current || activeUserIdRef.current !== currentUserId) return
          preservedCartRef.current = data.items
          checkoutStageSavedRef.current = true
          const previous: CartItem[] = Array.isArray(data.previousItems) ? data.previousItems : []
          previousCartRef.current = previous
          setPreviousCart(previous)
          setPreviousCartLoaded(true)
          const current: CartItem[] = data.pending && Array.isArray(data.currentItems) ? data.currentItems : data.items
          cartRef.current = current
          if (!data.pending) {
            checkoutCartPendingRef.current = false
            setCheckoutCartPending(false)
            sessionStorage.removeItem(CHECKOUT_CART_INTENT)
            sessionStorage.removeItem(CHECKOUT_CART_SELECTION_ID)
            localStorage.removeItem("cart_guest")
          }
          safeSetCart(current)
          persistLocal(current)
          return
        }

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
                const merged = mergeGuest(await keepPublicCartItems(parsed))
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
        if (checkoutItems) setCheckoutCartError("Your saved cart could not be loaded. Please retry before paying.")
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

  const prepareCheckoutSignIn = useCallback(() => {
    try {
      sessionStorage.setItem(CHECKOUT_CART_INTENT, JSON.stringify(cartRef.current))
      sessionStorage.setItem(CHECKOUT_CART_SELECTION_ID, crypto.randomUUID())
      localStorage.setItem("cart_guest", JSON.stringify(cartRef.current))
      if (cartUpdateTimeoutRef.current) clearTimeout(cartUpdateTimeoutRef.current)
      checkoutCartPendingRef.current = true
      checkoutStageSavedRef.current = false
      return true
    } catch {
      toast.error("Your cart could not be saved for sign-in. Please enable browser storage or continue as a guest.")
      return false
    }
  }, [])

  const resolveCheckoutCart = useCallback(async (includePrevious: boolean) => {
    if (!user?.id || !previousCartLoaded || resolvingCheckoutCartRef.current) return false
    const owner = user.id
    const current = cartRef.current
    const previous = previousCartRef.current
    const next = includePrevious ? mergeCheckoutCart(current, previous) : current
    const limitError = cartLimitError(next)
    if (limitError) { toast.error(limitError); return false }
    resolvingCheckoutCartRef.current = true
    setResolvingCheckoutCart(true)
    setCheckoutCartError("")
    try {
      const requestId = sessionStorage.getItem(CHECKOUT_CART_SELECTION_ID) || crypto.randomUUID()
      sessionStorage.setItem(CHECKOUT_CART_SELECTION_ID, requestId)
      const response = await fetch("/api/cart/checkout-selection", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: includePrevious ? "include" : "wishlist", items: current,
          previousItems: previous.map(item => ({ id: item.id || (item as CartItem & { productId?: string }).productId, quantity: item.quantity })) }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) throw new Error(data?.error || "Your cart choice could not be saved. Please retry.")
      if (activeUserIdRef.current !== owner) return false
      checkoutCartPendingRef.current = false
      try { sessionStorage.removeItem(CHECKOUT_CART_INTENT); sessionStorage.removeItem(CHECKOUT_CART_SELECTION_ID); localStorage.removeItem("cart_guest") } catch { /* Keep the acknowledged cart in memory. */ }
      const savedItems: CartItem[] = Array.isArray(data.items) ? data.items : next
      preservedCartRef.current = savedItems
      cartRef.current = savedItems
      safeSetCart(savedItems)
      persistLocal(savedItems)
      previousCartRef.current = []
      setPreviousCart([])
      setCheckoutCartPending(false)
      window.dispatchEvent(new Event("wishlist-updated"))
      toast.success(data.action === "include" ? "Your saved items are included in this checkout." : "Your saved items were moved to your wishlist.")
      return true
    } catch (error) {
      setCheckoutCartError(error instanceof Error ? error.message : "Your cart choice could not be saved.")
      return false
    } finally {
      resolvingCheckoutCartRef.current = false
      setResolvingCheckoutCart(false)
    }
  }, [user?.id, previousCartLoaded, persistLocal, safeSetCart])

  const abandonCheckoutCart = useCallback(async () => {
    if (loadPromiseRef.current) await loadPromiseRef.current
    if (resolvingCheckoutCartRef.current) {
      setCheckoutCartError("Please wait for your cart choice to finish saving.")
      return false
    }
    if (!checkoutCartPendingRef.current) return true
    if (!checkoutStageSavedRef.current) {
      setCheckoutCartError("Both carts could not be saved yet. Retry before leaving or signing out.")
      return false
    }
    checkoutCartPendingRef.current = false
    const combined = preservedCartRef.current
    cartRef.current = combined
    safeSetCart(combined)
    try {
      sessionStorage.removeItem(CHECKOUT_CART_INTENT)
      sessionStorage.removeItem(CHECKOUT_CART_SELECTION_ID)
      localStorage.removeItem("cart_guest")
    } catch { /* The combined cart is already stored on the account. */ }
    persistLocal(combined)
    previousCartRef.current = []
    setPreviousCart([])
    setCheckoutCartPending(false)
    return true
  }, [persistLocal, safeSetCart])

  useEffect(() => {
    // Sign-in/register are part of the checkout handoff. On any other page,
    // adopt the already preserved combined cart, even if navigation happened
    // while the initial preservation request was still loading.
    if (userId !== "guest" && pathname !== "/checkout" && pathname !== "/login" && pathname !== "/register"
      && checkoutCartPending && checkoutCartPendingRef.current) {
      void abandonCheckoutCart().then(saved => {
        if (!saved) toast.error("Your items are kept locally; reopen checkout to retry saving your cart.")
      })
    }
  }, [pathname, userId, checkoutCartPending, previousCartLoaded, abandonCheckoutCart])

  // ----- mount-time load (once per userId) ---------------------------------

  useEffect(() => {
    if (!user || userId === "guest") {
      if (loadedForUserIdRef.current !== userId) {
        loadedForUserIdRef.current = userId
        void loadCartFromDatabase()
      } else setIsLoading(false)
      return
    }

    // Skip if we already loaded (or attempted to load) for this userId.
    // This is the core fix for the spam: the auth `user` object reference
    // can churn (focus/visibility sync, profile refresh), but the userId
    // only changes on actual login/logout.
    if (loadedForUserIdRef.current === userId) {
      if (checkoutCartPendingRef.current) return
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
      const prev = cartRef.current
      const initialError = cartLimitError(prev.some((item) => item.id === product.id)
        ? prev.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + product.quantity } : item)
        : [...prev, product])
      if (initialError) { toast.error(initialError); return false }
      let stock = product.stock
      let price = product.price
      try {
        const response = await fetch(`/api/${product.type === "software" ? "software" : "products"}/${encodeURIComponent(product.id)}`)
        if (!response.ok) throw new Error("Product availability could not be checked. Please try again.")
        const data = await response.json()
        const current = data.product || data
        if (!current || typeof current !== "object" || Array.isArray(current) ||
          typeof current.price !== "number" || !Number.isFinite(current.price) || current.price <= 0) {
          throw new Error("Product price and availability could not be verified.")
        }
        if (typeof current.stock === "number") stock = current.stock
        if (typeof current.price === "number" && current.price > 0) price = current.price
      } catch (error) {
        console.error("[Cart] Availability check failed:", error)
        toast.error(error instanceof Error ? error.message : "Product availability could not be checked")
        return false
      }
      const currentCart = cartRef.current
      const updatedCart = (() => {
        const prev = currentCart
        const existingIndex = prev.findIndex((item) => item.id === product.id)
        let next: CartItem[]
        if (existingIndex >= 0) {
          next = [...prev]
          next[existingIndex] = {
            ...next[existingIndex],
            price,
            stock,
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
              price,
              stock,
              ...(product.maxDevices !== undefined && { maxDevices: product.maxDevices }),
              ...(product.validity !== undefined && { validity: product.validity }),
            },
          ]
        }
        return next
      })()
      const error = cartLimitError(updatedCart)
      const nextQuantity = updatedCart.find((item) => item.id === product.id)?.quantity || 0
      if (error || (typeof stock === "number" && nextQuantity > stock)) {
        toast.error(error || `Only ${stock} units of this product are available.`)
        return false
      }
      cartRef.current = updatedCart
      setCartState(updatedCart)
      persistLocal(updatedCart)

      if (user?.id && user.id !== "guest" && !checkoutCartPendingRef.current) {
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
      return true
    },
    [persistLocal, user],
  )

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(id)
        return true
      }
      const item = cartRef.current.find((item) => item.id === id)
      const next = cartRef.current.map((item) => item.id === id ? { ...item, quantity } : item)
      const error = cartLimitError(next)
      const reducing = !!item && Number.isSafeInteger(quantity) && quantity > 0 && quantity < item.quantity
      if (!reducing && (error || (typeof item?.stock === "number" && quantity > item.stock))) {
        toast.error(error || `Only ${item?.stock} units of this product are available.`)
        return false
      }
      cartRef.current = next
      setCartState(next)
      persistLocal(next)
      return true
    },
    [persistLocal, removeFromCart],
  )

  const clearCart = useCallback(() => {
    setCartState([])
    persistLocal([])
  }, [persistLocal])

  const refreshItemPrices = useCallback((prices: Record<string, number>, stocks: Record<string, number> = {}) => {
    setCartState((previous) => {
      let changed = false
      const next = previous.map((item) => {
        const price = prices[item.id]
        const stock = stocks[item.id]
        const validPrice = Number.isFinite(price) && price > 0
        const validStock = Number.isFinite(stock) && stock >= 0
        if ((!validPrice || price === item.price) && (!validStock || stock === item.stock)) return item
        changed = true
        return { ...item, ...(validPrice ? { price } : {}), ...(validStock ? { stock } : {}) }
      })
      if (!changed) return previous
      persistLocal(next)
      return next
    })
  }, [persistLocal])

  const syncCartWithDatabase = useCallback(async (requireSave = false) => {
    if (!user || user.id === "guest" || checkoutCartPendingRef.current) return
    const snapshot = cartRef.current
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, items: snapshot }),
      })
      if (!response.ok) throw new Error("Your cart could not be saved")
    } catch (error) {
      if (requireSave) throw error
      // network error — localStorage is primary
    }
  }, [user])

  useEffect(() => registerBeforeLogout(async () => {
    if (cartUpdateTimeoutRef.current) clearTimeout(cartUpdateTimeoutRef.current)
    const hadPendingChoice = checkoutCartPendingRef.current
    if (!await abandonCheckoutCart()) throw new Error("Checkout cart preservation is incomplete")
    // A pending choice already saved the entire combined selection. Keep it
    // even if the combined cart exceeds limits for a single purchase.
    const selection = (items: CartItem[]) => JSON.stringify(items.map(item => [item.id, item.quantity]))
    const alreadySaved = checkoutStageSavedRef.current
      && selection(cartRef.current) === selection(preservedCartRef.current)
    if (!hadPendingChoice && !alreadySaved) await syncCartWithDatabase(true)
  }), [registerBeforeLogout, abandonCheckoutCart, syncCartWithDatabase])

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
      if (checkoutCartPendingRef.current) return
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
      if (checkoutCartPendingRef.current) return
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
      refreshItemPrices,
      removeFromCart,
      clearCart,
      saveOrder,
      getOrders,
      getOrder,
      syncCartWithDatabase,
      loadCartFromDatabase,
      checkoutCartPending, previousCart, previousCartLoaded, checkoutCartError, resolvingCheckoutCart,
      prepareCheckoutSignIn, resolveCheckoutCart, abandonCheckoutCart,
    }),
    [
      cart,
      isLoading,
      addToCart,
      updateQuantity,
      refreshItemPrices,
      removeFromCart,
      clearCart,
      saveOrder,
      getOrders,
      getOrder,
      syncCartWithDatabase,
      loadCartFromDatabase,
      checkoutCartPending, previousCart, previousCartLoaded, checkoutCartError, resolvingCheckoutCart,
      prepareCheckoutSignIn, resolveCheckoutCart, abandonCheckoutCart,
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
