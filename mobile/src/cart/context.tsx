/**
 * Cart state.
 *
 * The cart is local-first: every mutation updates state immediately and is then
 * pushed to the server, because a shopper tapping "add" should never wait on a
 * round trip. Signed-out shoppers keep their cart in AsyncStorage and it is
 * merged into the server cart on sign-in, which mirrors what the web app does.
 *
 * Prices held here are for display only — `/api/orders` re-prices everything
 * from the catalogue, so a stale local price cannot affect what is charged.
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
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
import { fetchCart, saveCart } from "@/api/catalog"
import type { CartItem, Product } from "@/api/types"
import { useAuth } from "@/auth/context"

const GUEST_CART_KEY = "sara.guestCart"

interface CartContextValue {
  items: CartItem[]
  count: number
  subtotal: number
  isLoading: boolean
  add: (product: Product, quantity?: number) => void
  setQuantity: (id: string, quantity: number) => void
  remove: (id: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function mergeCarts(local: CartItem[], remote: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>()
  for (const item of remote) merged.set(item.id, { ...item })
  for (const item of local) {
    const existing = merged.get(item.id)
    // Take the larger quantity rather than summing: a shopper who added two on
    // the phone and two on the web wants two, not four.
    if (existing) existing.quantity = Math.max(existing.quantity, item.quantity)
    else merged.set(item.id, { ...item })
  }
  return [...merged.values()]
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hydrated = useRef(false)

  const persist = useCallback(
    async (next: CartItem[], authed: boolean) => {
      if (authed) {
        try {
          await saveCart(next)
          return
        } catch {
          // Fall through to local storage so the cart is not lost offline.
        }
      }
      await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(next)).catch(() => {})
    },
    [],
  )

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    ;(async () => {
      let local: CartItem[] = []
      try {
        const raw = await AsyncStorage.getItem(GUEST_CART_KEY)
        if (raw) local = JSON.parse(raw) as CartItem[]
      } catch {
        /* corrupt cache is not worth surfacing */
      }

      if (!isAuthenticated) {
        if (!cancelled) {
          setItems(local)
          setIsLoading(false)
          hydrated.current = true
        }
        return
      }

      try {
        const remote = await fetchCart()
        const merged = mergeCarts(local, remote.items ?? [])
        if (!cancelled) setItems(merged)
        if (local.length > 0) {
          await saveCart(merged)
          await AsyncStorage.removeItem(GUEST_CART_KEY).catch(() => {})
        }
      } catch {
        if (!cancelled) setItems(local)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          hydrated.current = true
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authLoading])

  const mutate = useCallback(
    (next: CartItem[]) => {
      setItems(next)
      if (hydrated.current) void persist(next, isAuthenticated)
    },
    [isAuthenticated, persist],
  )

  const value = useMemo<CartContextValue>(() => {
    const add = (product: Product, quantity = 1) => {
      const id = product.id
      const existing = items.find((item) => item.id === id)
      const next = existing
        ? items.map((item) => (item.id === id ? { ...item, quantity: item.quantity + quantity } : item))
        : [
            ...items,
            {
              id,
              productId: id,
              name: product.name,
              price: product.price,
              image: product.image,
              quantity,
            },
          ]
      mutate(next)
    }

    const setQuantity = (id: string, quantity: number) => {
      if (quantity <= 0) {
        mutate(items.filter((item) => item.id !== id))
        return
      }
      mutate(items.map((item) => (item.id === id ? { ...item, quantity } : item)))
    }

    return {
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      isLoading,
      add,
      setQuantity,
      remove: (id: string) => mutate(items.filter((item) => item.id !== id)),
      clear: () => mutate([]),
    }
  }, [items, isLoading, mutate])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used inside <CartProvider>")
  return context
}
