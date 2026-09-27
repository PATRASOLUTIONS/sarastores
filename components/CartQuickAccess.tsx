"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { ShoppingCart, ChevronRight, ChevronLeft, Tag } from "lucide-react"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"
import { useCartUI } from "@/contexts/CartUIContext"

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, n))

const COLLAPSE_KEY = "cartQuickAccess.collapsed"

/**
 * Thin vertical strip docked to the LEFT edge of the viewport.
 *
 * Renders only when:
 *   - the user is logged in (`useAuth().user` is set), AND
 *   - the cart has at least one item.
 *
 * Purpose:
 *   - Persistent, low-noise reminder that items are in the cart while
 *     the user keeps browsing the storefront.
 *   - One-tap access to the full Amazon-style cart drawer (right side).
 *   - Quick price glance + item count without leaving the page.
 *
 * Hidden on mobile (`< lg`) because the mobile bottom buy bar on the
 * product page and the bottom-nav on other pages already surface cart
 * access. The desktop strip is the missing piece.
 *
 * The user can collapse the strip to a small "tab" tab if it gets in
 * the way. The collapsed state persists in localStorage.
 */
export default function CartQuickAccess() {
  const { user } = useAuth()
  const { cart, isLoading } = useCart()
  const { openCart } = useCartUI()

  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1")
    } catch {
      // ignore
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0")
      } catch {
        // ignore
      }
      return next
    })
  }

  // Pulse the badge when a new item is added.
  const [pulse, setPulse] = useState(false)
  const [lastItemCount, setLastItemCount] = useState(0)
  useEffect(() => {
    const current = cart.reduce((n, i) => n + Number(i.quantity || 0), 0)
    if (current > lastItemCount && lastItemCount > 0) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 1400)
      return () => clearTimeout(t)
    }
    setLastItemCount(current)
  }, [cart, lastItemCount])

  const { itemCount, subtotal } = useMemo(() => {
    const items = cart.reduce((n, i) => n + Number(i.quantity || 0), 0)
    const total = cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0)
    return { itemCount: items, subtotal: total }
  }, [cart])

  // Visibility rule — must be logged in AND have items.
  const visible = !!user && itemCount > 0
  const previewItems = useMemo(() => cart.slice(0, 3), [cart])

  if (!visible) return null

  // Collapsed state — single-button tab. Tapping it expands the strip
  // (and opens the cart if the user wants).
  if (collapsed) {
    return (
      <motion.button
        type="button"
        key="cart-tab"
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={() => {
          toggleCollapsed()
        }}
        aria-label={`Expand cart quick access, ${itemCount} items`}
        className="hidden lg:flex flex-col items-center gap-1 fixed left-0 top-1/2 -translate-y-1/2 z-30 w-9 py-3 bg-white border border-gray-200 border-l-0 rounded-r-xl shadow-[2px_4px_18px_-6px_rgba(0,0,0,0.18)] hover:bg-brand-primary-subtle/40 transition-colors"
      >
        <ChevronRight className="h-3.5 w-3.5 text-brand-primary" />
        <ShoppingCart className="h-4 w-4 text-brand-primary" strokeWidth={2.25} />
        <span className="text-[10px] font-extrabold text-gray-700 tabular-nums leading-none">
          {itemCount}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-brand-primary" />
      </motion.button>
    )
  }

  return (
    <AnimatePresence>
      <motion.aside
        key="cart-quick-access"
        initial={{ x: -72, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -72, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        aria-label="Quick cart access"
        className="hidden lg:flex flex-col fixed left-0 top-1/2 -translate-y-1/2 z-30 w-[60px] bg-white/95 backdrop-blur border border-gray-200 border-l-0 rounded-r-2xl shadow-[2px_4px_18px_-6px_rgba(0,0,0,0.18)] overflow-hidden"
      >
        {/* Top — label badge */}
        <div className="relative bg-gradient-to-b from-brand-primary/10 to-transparent px-1 py-2 text-center">
          <p
            className="text-[9px] font-extrabold tracking-[0.18em] text-brand-primary uppercase leading-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Your Cart
          </p>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse cart quick access"
            className="absolute -right-1 top-1 h-4 w-4 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 flex items-center justify-center transition-colors shadow-sm"
          >
            <ChevronLeft className="h-2.5 w-2.5" strokeWidth={3} />
          </button>
        </div>

        {/* Middle — cart icon + animated badge */}
        <button
          type="button"
          onClick={openCart}
          aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
          className="relative flex flex-col items-center gap-1 py-2.5 hover:bg-brand-primary-subtle/40 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/40"
        >
          <span className="relative">
            <ShoppingCart
              className={`h-5 w-5 text-brand-primary transition-transform ${
                pulse ? "scale-110" : "scale-100"
              }`}
              strokeWidth={2.25}
            />
            <motion.span
              key={itemCount}
              initial={pulse ? { scale: 0.4 } : false}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="absolute -top-1.5 -right-2 bg-brand-accent text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ring-2 ring-white"
            >
              {itemCount > 99 ? "99+" : itemCount}
            </motion.span>
          </span>
          <span className="text-[10px] font-bold text-gray-700 tabular-nums leading-none">
            {itemCount}
          </span>
          <span className="text-[8.5px] uppercase tracking-wider text-gray-400 leading-none">
            items
          </span>
        </button>

        {/* Subtotal */}
        <div className="px-1 py-2 bg-gradient-to-b from-transparent to-brand-primary/5 text-center border-y border-gray-100">
          <p className="text-[8.5px] uppercase tracking-wider text-gray-400 leading-none mb-0.5">
            Total
          </p>
          <p className="text-[10.5px] font-extrabold text-gray-900 tabular-nums leading-tight">
            {formatINR(subtotal)}
          </p>
        </div>

        {/* Item previews — stacked thumbnails */}
        <div className="flex-1 flex flex-col items-center gap-1 py-2 min-h-0">
          {isLoading && previewItems.length === 0 ? (
            <div className="h-7 w-7 rounded-md bg-gray-100 animate-pulse" />
          ) : (
            previewItems.map((item) => (
              <button
                key={item.id}
                onClick={openCart}
                aria-label={`View ${item.name} in cart`}
                className="relative h-8 w-8 rounded-md bg-gray-50 border border-gray-200 overflow-hidden hover:border-brand-primary/50 transition-colors flex-shrink-0"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="32px"
                    className="object-contain p-0.5"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300">
                    <Tag className="h-3 w-3" />
                  </div>
                )}
                {item.quantity > 1 && (
                  <span className="absolute -bottom-0.5 -right-0.5 bg-brand-primary text-white text-[8px] font-bold rounded-full min-w-[13px] h-[13px] flex items-center justify-center px-0.5 ring-1 ring-white">
                    {item.quantity}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Proceed-to-buy CTA */}
        <button
          type="button"
          onClick={openCart}
          className="flex flex-col items-center gap-0.5 px-1 py-2.5 bg-gradient-to-b from-brand-accent to-orange-500 text-white hover:brightness-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-accent/50"
          aria-label="Open cart and proceed to buy"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.75} />
          <span
            className="text-[9px] font-extrabold uppercase tracking-wider leading-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Buy
          </span>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.75} />
        </button>
      </motion.aside>
    </AnimatePresence>
  )
}
