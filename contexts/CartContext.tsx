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
import { cartLineKey, findCartLine, type CartLineIdentity } from "@/lib/cart-line"
import { purchaseAvailabilityError, purchaseStock, purchaseLimit } from "@/lib/purchase-validation"
import { isSaraCare, SaraCareQuoteResponseSchema, type SaraCareSnapshot, type SaraCareYears, type SaraCareOffer } from "@/lib/sara-care-types"

export interface CartItem {
  saraCare?: SaraCareSnapshot
  saraCareSelection?: SaraCareYears | null
  color: string | null
  size: string | null
  id: string
  name: string
  price: number
  image: string
  quantity: number
  stock?: number
  maxPurchaseQuantity?: number
  sku?: string
  variantId?: string
  ram?: string
  storage?: string
  type?: "software" | "hardware" | "service"
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
  saraCareOffers: SaraCareOffer[]
  saraCareError: string
  saraCareLoading: boolean
  removeAllSaraCare: () => void
  setSaraCareDuration: (parentLineKey: string, years: SaraCareYears | null) => void
  refreshSaraCare: () => void
  cart: CartItem[]
  isLoading: boolean
  isHydrating: boolean
  addToCart: (product: CartItem) => Promise<boolean>
  updateQuantity: (id: string, quantity: number) => boolean
  refreshItemPrices: (prices: Record<string, number>, stocks?: Record<string, number>) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  completePurchase: (items: Array<CartLineIdentity & { quantity: number }>, orderId: string) => Promise<void>
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
const careCartKey = (owner: string, items: CartItem[]) => JSON.stringify([owner, items.filter(item => !isSaraCare(item)).map(item =>
  [cartLineKey(item), item.quantity, item.price, item.saraCareSelection === undefined ? "default" : item.saraCareSelection])])

async function keepPublicCartItems(items: CartItem[]): Promise<CartItem[]> {
  const productIds = [...new Set(items
    .filter(item => item.type !== "software" && !isSaraCare(item))
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
    return items.filter(item => item.type === "software" || isSaraCare(item) || visibleIds.has(item.id))
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
  const [saraCareOffers, setSaraCareOffers] = useState<SaraCareOffer[]>([])
  const [saraCareError, setSaraCareError] = useState("")
  const [careQuotedKey, setCareQuotedKey] = useState("")
  const [careAttempt, setCareAttempt] = useState(0)
  const careInputKey = careCartKey(userId, cart)
  const careNeeded = cart.some(item => isSaraCare(item) || item.type !== "software" && item.saraCareSelection !== null)
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
  const addingLines = useRef(new Set<string>())
  const lastAddAt = useRef(new Map<string, number>())
  const lastQuantityAt = useRef(new Map<string, number>())
  const cartSyncQueue = useRef<Promise<void>>(Promise.resolve())

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
    cartRef.current = next
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
  const setSaraCareDuration = useCallback((parentLineKey: string, years: SaraCareYears | null) => {
    const next = cartRef.current.filter(item => item.saraCare?.parentLineKey !== parentLineKey)
      .map(item => cartLineKey(item) === parentLineKey ? { ...item, saraCareSelection: years } : item)
    safeSetCart(next)
    persistLocal(next)
  }, [safeSetCart, persistLocal])
  const refreshSaraCare = useCallback(() => { setCareQuotedKey(""); setCareAttempt(attempt => attempt + 1) }, [])
  const removeAllSaraCare = useCallback(() => {
    const next = cartRef.current.filter(item => !isSaraCare(item)).map(item => ({ ...item, saraCareSelection: null }))
    safeSetCart(next)
    persistLocal(next)
    setSaraCareError("")
    // Refresh offers in the background so protection can be added back later.
    // Explicit opt-outs never wait for this optional service before checkout.
    setCareQuotedKey("")
  }, [safeSetCart, persistLocal, userId])
  useEffect(() => {
    if (isLoading || careQuotedKey === careInputKey) return
    const controller = new AbortController()
    const parents = cartRef.current.filter(item => !isSaraCare(item))
    if (!parents.length) {
      setSaraCareOffers([]); setSaraCareError(""); setCareQuotedKey(careInputKey)
      if (cartRef.current.length) safeSetCart([])
      return
    }
    setSaraCareError("")
    const quote = async () => {
      try {
        const response = await fetch("/api/sara-care/quote", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: parents }), signal: AbortSignal.any([controller.signal,
            AbortSignal.timeout(process.env.NODE_ENV === "development" ? 60000 : 30000)]), cache: "no-store" })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || "Sara Care could not be refreshed. Please retry.")
        const parsed = SaraCareQuoteResponseSchema.parse(data)
        if (controller.signal.aborted || careCartKey(activeUserIdRef.current, cartRef.current) !== careInputKey) return
        const next: CartItem[] = parents.flatMap(parent => {
          const care = parsed.items.filter(item => item.saraCare.parentLineKey === cartLineKey(parent))
          return [{ ...parent, ...(parent.saraCareSelection === undefined && care.length ? { saraCareSelection: care[0].saraCare.durationYears } : {}) }, ...care]
        })
        const addedDefault = parsed.items.some(item => parents.some(parent => cartLineKey(parent) === item.saraCare.parentLineKey && parent.saraCareSelection === undefined) &&
          !cartRef.current.some(current => current.saraCare?.parentLineKey === item.saraCare.parentLineKey))
        if (addedDefault) toast.success("Optional Sara Care added as a separate cart product. You can change or remove it.")
        setSaraCareOffers(parsed.offers)
        safeSetCart(next)
        persistLocal(next)
        setCareQuotedKey(careCartKey(userId, next))
      } catch (error) {
        if (controller.signal.aborted || careCartKey(activeUserIdRef.current, cartRef.current) !== careInputKey) return
        if (parents.every(parent => parent.type === "software" || parent.saraCareSelection === null)) {
          setSaraCareError(""); setCareQuotedKey(careInputKey); return
        }
        const timedOut = error instanceof Error && error.name === "TimeoutError"
        setSaraCareError(timedOut ? "Sara Care prices took too long to load. Retry, or continue without Sara Care. Your device items are saved."
          : error instanceof Error ? error.message : "Sara Care could not be refreshed. Please retry.")
        setCareQuotedKey(careInputKey)
      }
    }
    void quote()
    return () => controller.abort()
  }, [careInputKey, careQuotedKey, careAttempt, isLoading, persistLocal, safeSetCart, userId])

  const saveAccountCart = useCallback(async (snapshot: CartItem[], requireSave = false) => {
    if (userId === "guest" || checkoutCartPendingRef.current) return
    const save = cartSyncQueue.current.catch(() => {}).then(async () => {
      if (activeUserIdRef.current !== userId) return
      const response = await fetch("/api/cart", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: snapshot }),
      })
      if (!response.ok) throw new Error("Your cart could not be saved")
    })
    cartSyncQueue.current = save
    try { await save } catch (error) { if (requireSave) throw error }
  }, [userId])

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
      const merged = mergeCheckoutCart(guestItems, serverItems)
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
          previousItems: previous.map(item => ({ ...item, id: item.id || (item as CartItem & { productId?: string }).productId })) }),
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
      const removed = findCartLine(cartRef.current, id)
      if (!removed) return
      if (removed.saraCare) { setSaraCareDuration(removed.saraCare.parentLineKey, null); return }
      const next = cartRef.current.filter(item => cartLineKey(item) !== cartLineKey(removed) && item.saraCare?.parentLineKey !== cartLineKey(removed))
      safeSetCart(next)
      persistLocal(next)
      void saveAccountCart(next)
      analytics.removeFromCart(toAnalyticsItem(removed))
    },
    [persistLocal, safeSetCart, saveAccountCart, setSaraCareDuration],
  )

  const addToCart = useCallback(
    async (product: CartItem) => {
      if (isSaraCare(product)) { toast.error("Add Sara Care through the device it protects."); return false }
      const owner = activeUserIdRef.current
      const lineKey = cartLineKey(product)
      const actionKey = `${owner}:${lineKey}`
      if (addingLines.current.has(actionKey) || Date.now() - (lastAddAt.current.get(actionKey) || 0) < 500) return false
      addingLines.current.add(actionKey)
      try {
      // Guests keep their cart in localStorage under `cart_guest`; it is merged
      // into the account cart on login. Forcing login here was the single
      // largest drop-off in the funnel.
      const prev = cartRef.current
      const initialError = cartLimitError(prev.some((item) => cartLineKey(item) === lineKey)
        ? prev.map((item) => cartLineKey(item) === lineKey ? { ...item, quantity: item.quantity + product.quantity } : item)
        : [...prev, product])
      if (initialError) { toast.error(initialError); return false }
      let stock = product.stock
      let price = product.price
      let maxPurchaseQuantity = product.maxPurchaseQuantity
      try {
        const response = await fetch(`/api/${product.type === "software" ? "software" : "products"}/${encodeURIComponent(product.id)}`)
        if (!response.ok) throw new Error("Product availability could not be checked. Please try again.")
        const data = await response.json()
        const current = data.product || data
        if (!current || typeof current !== "object" || Array.isArray(current) ||
          typeof current.price !== "number" || !Number.isFinite(current.price) || current.price <= 0) {
          throw new Error("Product price and availability could not be verified.")
        }
        const unavailable = purchaseAvailabilityError(current, product.type === "software")
        if (unavailable) throw new Error(unavailable)
        stock = purchaseStock(current, product.type === "software") ?? undefined
        maxPurchaseQuantity = purchaseLimit(current)
        if (typeof current.price === "number" && current.price > 0) price = current.price
      } catch (error) {
        console.error("[Cart] Availability check failed:", error)
        toast.error(error instanceof Error ? error.message : "Product availability could not be checked")
        return false
      }
      if (activeUserIdRef.current !== owner) return false
      const currentCart = cartRef.current
      const updatedCart = (() => {
        const prev = currentCart
        const existingIndex = prev.findIndex((item) => cartLineKey(item) === lineKey)
        let next: CartItem[]
        if (existingIndex >= 0) {
          next = [...prev]
          next[existingIndex] = {
            ...next[existingIndex],
            price,
            stock,
            maxPurchaseQuantity,
            quantity: next[existingIndex].quantity + product.quantity,
            ...(product.saraCareSelection !== undefined ? { saraCareSelection: product.saraCareSelection } : {}),
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
              quantity: product.quantity,
              type: product.type || "hardware",
              price,
              stock,
              maxPurchaseQuantity,
              ...(product.maxDevices !== undefined && { maxDevices: product.maxDevices }),
              ...(product.validity !== undefined && { validity: product.validity }),
            },
          ]
        }
        const parentLine = next.find(item => !isSaraCare(item) && cartLineKey(item) === lineKey)
        return next.flatMap(item => {
          if (item.saraCare?.parentLineKey !== lineKey || !parentLine) return [item]
          if (parentLine.saraCareSelection === null || (parentLine.saraCareSelection !== undefined && parentLine.saraCareSelection !== item.saraCare.durationYears)) return []
          return [{ ...item, quantity: parentLine.quantity }]
        })
      })()
      const error = cartLimitError(updatedCart)
      const nextQuantity = updatedCart.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0)
      if (error || nextQuantity > (maxPurchaseQuantity ?? purchaseLimit({})) || (typeof stock === "number" && nextQuantity > stock)) {
        toast.error(error || (nextQuantity > (maxPurchaseQuantity ?? purchaseLimit({}))
          ? `You can purchase up to ${maxPurchaseQuantity} units of this product.` : `Only ${stock} units of this product are available.`))
        return false
      }
      safeSetCart(updatedCart)
      persistLocal(updatedCart)
      await saveAccountCart(updatedCart)

      lastAddAt.current.set(actionKey, Date.now())
      analytics.addToCart(toAnalyticsItem(product, product.quantity))
      return true
      } finally { addingLines.current.delete(actionKey) }
    },
    [persistLocal, safeSetCart, saveAccountCart],
  )

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > purchaseLimit({})) { toast.error("Quantity must be a positive whole number within the purchase limit."); return false }
      const item = findCartLine(cartRef.current, id)
      if (!item) return false
      if (isSaraCare(item)) { toast.error("Sara Care quantity follows the covered product."); return false }
      if (quantity === item.quantity) return true
      const actionKey = `${activeUserIdRef.current}:${cartLineKey(item)}`
      if (Date.now() - (lastQuantityAt.current.get(actionKey) || 0) < 300) return false
      const next = cartRef.current.map(existing => cartLineKey(existing) === cartLineKey(item) || existing.saraCare?.parentLineKey === cartLineKey(item) ? { ...existing, quantity } : existing)
      const error = cartLimitError(next)
      const reducing = !!item && Number.isSafeInteger(quantity) && quantity > 0 && quantity < item.quantity
      const totalQuantity = next.filter(existing => existing.id === item.id).reduce((sum, existing) => sum + existing.quantity, 0)
      const maximum = item.maxPurchaseQuantity ?? purchaseLimit({})
      if (!reducing && (error || totalQuantity > maximum || (typeof item.stock === "number" && totalQuantity > item.stock))) {
        toast.error(error || (totalQuantity > maximum ? `You can purchase up to ${maximum} units of this product.` : `Only ${item.stock} units of this product are available.`))
        return false
      }
      safeSetCart(next)
      lastQuantityAt.current.set(actionKey, Date.now())
      persistLocal(next)
      void saveAccountCart(next)
      return true
    },
    [persistLocal, safeSetCart, saveAccountCart],
  )

  const clearCart = useCallback(() => {
    if (!cartRef.current.length) return
    safeSetCart([])
    persistLocal([])
    void saveAccountCart([])
  }, [persistLocal, safeSetCart, saveAccountCart])

  const completedCartPurchases = useRef(new Set<string>())
  const completePurchase = useCallback(async (items: Array<CartLineIdentity & { quantity: number }>, orderId: string) => {
    if (activeUserIdRef.current !== userId) return
    const completionKey = `sara_cart_purchase:${userId}:${orderId}`
    if (completedCartPurchases.current.has(completionKey)) return
    try { if (localStorage.getItem(completionKey)) return } catch { /* The in-memory guard still prevents repeated callbacks. */ }
    completedCartPurchases.current.add(completionKey)
    try { localStorage.setItem(completionKey, "1") } catch { /* Keep the in-memory guard. */ }
    const bought = new Map<string, number>()
    for (const item of items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) continue
      const line = cartLineKey(item)
      bought.set(line, (bought.get(line) || 0) + item.quantity)
    }
    const current = cartRef.current
    const next = current.flatMap(item => {
      const quantity = item.quantity - (bought.get(cartLineKey(item)) || 0)
      return quantity > 0 ? [{ ...item, quantity }] : []
    })
    if (next.length === current.length && next.every((item, index) => item.quantity === current[index].quantity)) return
    safeSetCart(next)
    persistLocal(next)
    await saveAccountCart(next)
  }, [safeSetCart, persistLocal, saveAccountCart, userId])

  const refreshItemPrices = useCallback((prices: Record<string, number>, stocks: Record<string, number> = {}) => {
    const previous = cartRef.current
    let changed = false
    const next = previous.map((item) => {
      const price = prices[cartLineKey(item)] ?? (isSaraCare(item) ? undefined : prices[item.id])
      const stock = stocks[item.id]
      const validPrice = Number.isFinite(price) && price > 0
      const validStock = Number.isFinite(stock) && stock >= 0
      if ((!validPrice || price === item.price) && (!validStock || stock === item.stock)) return item
      changed = true
      return { ...item, ...(validPrice ? { price } : {}), ...(validStock ? { stock } : {}) }
    })
    if (!changed) return
    safeSetCart(next)
    persistLocal(next)
  }, [persistLocal, safeSetCart])

  const availabilityKey = JSON.stringify([...new Map(cart.filter(item => !isSaraCare(item)).map(item => [item.id, item.type || "hardware"])).entries()].sort())
  useEffect(() => {
    const identities: Array<[string, string]> = JSON.parse(availabilityKey)
    if (!identities.length || isLoading) return
    const controller = new AbortController()
    let refreshing = false
    const refresh = async () => {
      if (refreshing || document.visibilityState === "hidden") return
      refreshing = true
      try {
        const prices: Record<string, number> = {}
        const stocks: Record<string, number> = {}
        const hardware = identities.filter(([, type]) => type !== "software").map(([id]) => id)
        if (hardware.length) {
          const response = await fetch("/api/products/bulk", { method: "POST", signal: controller.signal,
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: hardware }) })
          if (!response.ok) throw new Error("Product availability could not be refreshed")
          const products = await response.json()
          if (!Array.isArray(products)) throw new Error("Invalid availability response")
          for (const id of hardware) {
            const product = products.find(product => product.id === id || product._id === id)
            stocks[id] = product && !purchaseAvailabilityError(product) ? purchaseStock(product) ?? 0 : 0
            if (product && typeof product.price === "number" && product.price > 0) prices[id] = product.price
          }
        }
        for (const [id, type] of identities) {
          if (type !== "software") continue
          const response = await fetch(`/api/software/${encodeURIComponent(id)}`, { signal: controller.signal })
          if (response.status === 404) { stocks[id] = 0; continue }
          if (!response.ok) throw new Error("Software availability could not be refreshed")
          const data = await response.json()
          const product = data.product || data
          if (purchaseAvailabilityError(product, true)) { stocks[id] = 0; continue }
          const stock = purchaseStock(product, true)
          if (stock !== null) stocks[id] = stock
          if (typeof product.price === "number" && product.price > 0) prices[id] = product.price
        }
        if (!controller.signal.aborted) refreshItemPrices(prices, stocks)
      } catch { /* Keep the last display snapshot; checkout always revalidates. */ }
      finally { refreshing = false }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 30000)
    window.addEventListener("focus", refresh)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh) }
  }, [availabilityKey, isLoading, refreshItemPrices])

  const syncCartWithDatabase = useCallback(async (requireSave = false) => {
    await saveAccountCart(cartRef.current, requireSave)
  }, [saveAccountCart])

  useEffect(() => registerBeforeLogout(async () => {
    if (cartUpdateTimeoutRef.current) clearTimeout(cartUpdateTimeoutRef.current)
    const hadPendingChoice = checkoutCartPendingRef.current
    if (!await abandonCheckoutCart()) throw new Error("Checkout cart preservation is incomplete")
    // A pending choice already saved the entire combined selection. Keep it
    // even if the combined cart exceeds limits for a single purchase.
    const selection = (items: CartItem[]) => JSON.stringify(items.map(item => [cartLineKey(item), item.quantity]))
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
      isHydrating: isLoading,
      isLoading: isLoading || careNeeded && careQuotedKey !== careInputKey,
      saraCareLoading: !isLoading && careNeeded && careQuotedKey !== careInputKey,
      removeAllSaraCare,
      saraCareOffers, saraCareError, setSaraCareDuration, refreshSaraCare,
      addToCart,
      updateQuantity,
      refreshItemPrices,
      removeFromCart,
      clearCart,
      completePurchase,
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
      careQuotedKey, careInputKey, careNeeded, saraCareOffers, saraCareError, setSaraCareDuration, refreshSaraCare,
      removeAllSaraCare,
      addToCart,
      updateQuantity,
      refreshItemPrices,
      removeFromCart,
      clearCart,
      completePurchase,
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
