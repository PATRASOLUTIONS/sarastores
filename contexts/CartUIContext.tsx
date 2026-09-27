"use client"

import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

interface CartUIContextValue {
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  /**
   * Last item added to the cart — used by the sidebar to flash a "Just
   * added" highlight on the matching line item. Optional; consumers can
   * ignore it.
   */
  lastAddedId: string | null
  setLastAddedId: (id: string | null) => void
}

const CartUIContext = createContext<CartUIContextValue | undefined>(undefined)

export function CartUIProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])
  const toggleCart = useCallback(() => setIsOpen((v) => !v), [])

  // Esc to close — keep the global side effect inside the provider so
  // there's exactly one listener no matter how many components consume
  // the context.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Lock body scroll when the sidebar is open on mobile so the page
  // behind it doesn't scroll. Desktop panels are narrower and usually
  // don't need scroll lock, but it's harmless to apply uniformly.
  useEffect(() => {
    if (typeof document === "undefined") return
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isOpen])

  const value = useMemo(
    () => ({ isOpen, openCart, closeCart, toggleCart, lastAddedId, setLastAddedId }),
    [isOpen, openCart, closeCart, toggleCart, lastAddedId],
  )

  return <CartUIContext.Provider value={value}>{children}</CartUIContext.Provider>
}

export function useCartUI() {
  const ctx = useContext(CartUIContext)
  if (!ctx) {
    throw new Error("useCartUI must be used within a CartUIProvider")
  }
  return ctx
}
