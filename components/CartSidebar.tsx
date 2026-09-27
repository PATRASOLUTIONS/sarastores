"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Minus,
  Plus,
  Trash2,
  X,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Tag,
} from "lucide-react"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"
import { useCartUI } from "@/contexts/CartUIContext"
import { toast } from "react-hot-toast"

const FREE_DELIVERY_THRESHOLD = 5000

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, n))

export default function CartSidebar() {
  const { isOpen, closeCart, lastAddedId, setLastAddedId } = useCartUI()
  const { user } = useAuth()
  const router = useRouter()
  const { cart, updateQuantity, removeFromCart, clearCart, isLoading } = useCart()

  // Track which line item was just added so we can flash it. The
  // highlight is removed after ~1.6s.
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (!lastAddedId) return
    setHighlightId(lastAddedId)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => {
      setHighlightId(null)
      setLastAddedId(null)
    }, 1600)
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [lastAddedId, setLastAddedId])

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [cart],
  )
  const itemCount = useMemo(
    () => cart.reduce((n, item) => n + Number(item.quantity || 0), 0),
    [cart],
  )
  const freeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD
  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal)

  const handleQuantity = (id: string, color: string | null, size: string | null, next: number) => {
    if (next < 1) {
      removeFromCart(id)
      toast.success("Item removed from cart")
      return
    }
    // `useCart` updates by id only, so re-use the same path
    void color
    void size
    updateQuantity(id, next)
  }

  const handleRemove = (id: string, name: string) => {
    removeFromCart(id)
    toast.success(`Removed "${name.length > 32 ? `${name.slice(0, 32)}…` : name}"`)
  }

  const handleProceedToBuy = () => {
    if (!user) {
      const currentPath =
        typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"
      closeCart()
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
      return
    }
    closeCart()
    router.push("/checkout")
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100]" aria-modal="true" role="dialog" aria-label="Shopping cart">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
          />

          {/* Panel — full-screen on mobile, 420px drawer on desktop */}
          <motion.aside
            key="panel"
            className="absolute top-0 right-0 h-full w-full sm:max-w-[420px] bg-white shadow-2xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-primary/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Your Cart</h2>
                  <p className="text-[11px] text-gray-500">
                    {itemCount === 0
                      ? "Empty"
                      : `${itemCount} item${itemCount > 1 ? "s" : ""} • ${formatINR(subtotal)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={closeCart}
                aria-label="Close cart"
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Free-delivery progress */}
            {cart.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                {freeDelivery ? (
                  <p className="text-[12px] text-emerald-700 font-semibold flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    You qualify for FREE delivery!
                  </p>
                ) : (
                  <p className="text-[12px] text-gray-700 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-brand-primary" />
                    Add <span className="font-bold text-brand-primary">{formatINR(remainingForFreeDelivery)}</span> more for FREE delivery
                  </p>
                )}
                <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-primary to-brand-accent transition-all duration-500"
                    style={{ width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isLoading && cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent mb-3" />
                  Loading your cart…
                </div>
              ) : cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="bg-gray-100 rounded-full p-5 mb-4">
                    <ShoppingCart className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Your cart is empty</h3>
                  <p className="text-[12.5px] text-gray-500 mb-5">
                    Add items to your cart to see them here.
                  </p>
                  <button
                    onClick={closeCart}
                    className="px-5 py-2 bg-brand-primary text-white text-[13px] font-semibold rounded-lg hover:bg-brand-primary-hover transition-colors"
                  >
                    Continue shopping
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cart.map((item) => {
                    const lineKey = `${item.id}-${item.color || ""}-${item.size || ""}`
                    const isHighlighted = highlightId === item.id
                    return (
                      <li
                        key={lineKey}
                        className={`flex gap-3 p-3 rounded-xl border transition-all duration-300 ${
                          isHighlighted
                            ? "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200"
                            : "border-gray-100 bg-white hover:border-gray-200"
                        }`}
                      >
                        {/* Image */}
                        <Link
                          href={`/product/${encodeURIComponent(item.id)}`}
                          onClick={closeCart}
                          className="relative h-20 w-20 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-100"
                        >
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="80px"
                              className="object-contain p-1"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-300">
                              <ShoppingCart className="h-6 w-6" />
                            </div>
                          )}
                        </Link>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/product/${encodeURIComponent(item.id)}`}
                            onClick={closeCart}
                            className="block text-[13px] font-semibold text-gray-900 hover:text-brand-primary line-clamp-2 leading-snug"
                          >
                            {item.name}
                          </Link>

                          {(item.color || item.size) && (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {item.color && <span>Color: {item.color}</span>}
                              {item.color && item.size && <span> · </span>}
                              {item.size && <span>Size: {item.size}</span>}
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[14px] font-bold text-gray-900 tabular-nums">
                              {formatINR(item.price * item.quantity)}
                              <span className="ml-1.5 text-[11px] font-normal text-gray-500">
                                ({formatINR(item.price)} ea)
                              </span>
                            </p>
                          </div>

                          {/* Qty + remove */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() =>
                                  handleQuantity(item.id, item.color, item.size, item.quantity - 1)
                                }
                                aria-label="Decrease quantity"
                                className="p-1.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-8 text-center text-[12.5px] font-semibold tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  handleQuantity(item.id, item.color, item.size, item.quantity + 1)
                                }
                                aria-label="Increase quantity"
                                className="p-1.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <button
                              onClick={() => handleRemove(item.id, item.name)}
                              aria-label="Remove from cart"
                              className="text-[11.5px] font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}

                  {/* Clear cart */}
                  {cart.length > 1 && (
                    <li>
                      <button
                        onClick={() => {
                          if (typeof window !== "undefined" && !window.confirm("Clear all items from cart?")) {
                            return
                          }
                          clearCart()
                          toast.success("Cart cleared")
                        }}
                        className="w-full text-[11.5px] text-gray-500 hover:text-rose-600 font-semibold py-1.5"
                      >
                        Clear cart
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Footer — subtotal + Proceed to Buy */}
            {cart.length > 0 && (
              <div className="border-t border-gray-100 bg-white px-5 py-4 space-y-3 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)]">
                <div className="space-y-1 text-[12.5px]">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Subtotal ({itemCount} item{itemCount > 1 ? "s" : ""})</span>
                    <span className="font-semibold tabular-nums">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Delivery
                    </span>
                    <span className={`font-semibold ${freeDelivery ? "text-emerald-700" : "text-gray-700"}`}>
                      {freeDelivery ? "FREE" : "Calculated at checkout"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-gray-200">
                    <span className="text-[13.5px] font-bold text-gray-900">Total</span>
                    <span className="text-[18px] font-extrabold text-gray-900 tabular-nums">
                      {formatINR(subtotal)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleProceedToBuy}
                  className="w-full bg-gradient-to-r from-brand-accent to-orange-500 hover:from-brand-accent-hover hover:to-orange-600 text-white font-bold text-[14px] py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Tag className="h-4 w-4" />
                  Proceed to Buy
                </button>

                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="block text-center text-[12px] text-brand-primary hover:text-brand-primary-hover font-semibold"
                >
                  View full cart
                </Link>

                <p className="text-[10.5px] text-gray-500 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" />
                  Secure transaction · SSL encrypted
                </p>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
