"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useCart } from "@/hooks/useCart"
import { useWishlist } from "@/hooks/useWishlist"
import { useAuth } from "@/contexts/AuthContext"
import { cleanProductName } from "@/utils/cleanProductName"
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  CreditCard,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { motion, AnimatePresence } from 'framer-motion'
import { durations, easings } from '@/lib/animations'
import { PageTransition, AnimatedCounter, Reveal } from '@/components/motion/AnimationComponents'
import TrustStrip from "@/components/account/TrustStrip"

const CHECKOUT_STEPS = ["Cart", "Address", "Payment", "Place Order"]

const CART_OFFERS = [
  { title: "No Cost EMI", detail: "Available on select products and cards." },
  { title: "Bank Offers", detail: "Card discounts are applied at checkout." },
  { title: "Free Delivery", detail: "On eligible orders across Karnataka." },
]

interface Suggestion {
  id: string
  name: string
  price: number
  mrp?: number
  image?: string
  images?: string[]
  slug?: string
}

const suggestionImage = (product: Suggestion) => product.image || product.images?.[0] || "/placeholder.svg"

export default function CartPage() {
  const { cart, addToCart, updateQuantity, removeFromCart, clearCart, isLoading: cartLoading } = useCart()
  const { user } = useAuth()
  const { addToWishlist } = useWishlist()
  const [subtotal, setSubtotal] = useState(0)
  const [tax, setTax] = useState(0)
  const [shipping, setShipping] = useState(0)
  const [total, setTotal] = useState(0)
  const [mrpById, setMrpById] = useState<Record<string, number>>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Total MRP saving across the cart. Zero when no line has a usable MRP.
  const savings = cart.reduce((sum, item) => {
    const mrp = mrpById[item.id]
    if (!mrp || mrp <= item.price) return sum
    return sum + (mrp - item.price) * (item.quantity || 1)
  }, 0)

  // Cart gross is tax-inclusive (price × qty); MRP rolls up from it plus the saving.
  const grossTotal = subtotal + tax
  const totalMrp = grossTotal + savings

  // Wait for cart to finish loading
  useEffect(() => {
    if (!cartLoading) {
      setIsLoading(false)
    }
  }, [cartLoading])

  // Ensure cart is refreshed whenever this page is opened (helps when items were added elsewhere)
  useEffect(() => {
    // Dispatch the same event the hook listens to so it reloads from localStorage
    try {
      window.dispatchEvent(new Event("cart-updated"))
      // also trigger a storage event fallback for some browsers
      try { localStorage.setItem('cart-refresh-ts', String(Date.now())) } catch (e) {}
    } catch (e) {
      // Silently ignore storage errors (private browsing, quota exceeded)
    }
  }, [])

  // Fetch MRPs so the summary can show a real "you save" figure. Cart items
  // only carry the selling price, and older carts predate any MRP field.
  useEffect(() => {
    const ids = cart.map((item) => item.id).filter(Boolean)
    if (ids.length === 0) {
      setMrpById({})
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, compare: true }),
        })
        if (!res.ok) return
        const products = await res.json()
        if (cancelled || !Array.isArray(products)) return

        const next: Record<string, number> = {}
        for (const product of products) {
          const mrp = Number(product?.mrp)
          if (Number.isFinite(mrp) && mrp > 0) next[String(product.id)] = mrp
        }
        setMrpById(next)
      } catch {
        // Savings display is cosmetic — fail quietly.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cart])

  // Calculate totals whenever cart changes
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.log("Cart page loaded, current cart:", cart)

    // Sum gross totals (assume item.price includes GST)
    let grossTotal = 0
    let hardwareGrossTotal = 0
    let hasHardware = false

    cart.forEach(item => {
      const lineGross = (item.price || 0) * (item.quantity || 1)
      grossTotal += lineGross
      if (item.type !== 'software') {
        hardwareGrossTotal += lineGross
        hasHardware = true
      }
    })

    // Subtotal (tax-exclusive) = gross / 1.18
    const newSubtotal = grossTotal > 0 ? grossTotal / 1.18 : 0

    // Tax (18% GST) = 18% of subtotal
    const newTax = newSubtotal * 0.18

    // Shipping (only for hardware items)
    let newShipping = 0
    if (hasHardware) {
      // Keep previous shipping rule: charge 1000 if hardware gross <= 1000, otherwise free
      newShipping = (hardwareGrossTotal > 0 && hardwareGrossTotal <= 1000) ? 1000 : 0
    }

    // Total = subtotal (base) + tax + shipping => equals grossTotal + shipping
    const newTotal = newSubtotal + newTax + newShipping

    // Set the values for display
    setSubtotal(Number(newSubtotal.toFixed(2)))
    setTax(Number(newTax.toFixed(2)))
    setShipping(newShipping)
    setTotal(Number(newTotal.toFixed(2)))
  }, [cart])

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return
    updateQuantity(id, newQuantity)
    toast.success("Cart updated")
  }
  const handleRemoveItem = (id: string, name: string) => {
    removeFromCart(id)
    toast.success(`${name} removed from cart`)
  }

  const handleClearCart = () => {
    if (window.confirm("Are you sure you want to clear your cart?")) {
      clearCart()
      toast.success("Cart cleared")
    }
  }

  // Keep the selection in step with the cart: new lines arrive selected,
  // removed lines drop out. Selection drives the bulk-remove action only —
  // checkout always reads the full cart, so the totals cannot drift from it.
  useEffect(() => {
    setSelectedIds((previous) => {
      const ids = cart.map((item) => item.id)
      const kept = previous.filter((id) => ids.includes(id))
      const added = ids.filter((id) => !previous.includes(id))
      return [...kept, ...added]
    })
  }, [cart])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch("/api/products?fields=card&limit=6")
        if (!response.ok || cancelled) return
        const raw = await response.json()
        const list = Array.isArray(raw) ? raw : raw?.products || []
        setSuggestions(list.slice(0, 6))
      } catch {
        // Cross-sell rail is optional merchandising.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const allSelected = cart.length > 0 && selectedIds.length === cart.length

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : cart.map((item) => item.id))
  }

  const toggleItem = (id: string) => {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    )
  }

  const handleRemoveSelected = () => {
    if (selectedIds.length === 0) return
    selectedIds.forEach((id) => removeFromCart(id))
    toast.success(selectedIds.length === 1 ? "Item removed" : "Selected items removed")
  }

  const handleAddSuggestion = (product: Suggestion) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: suggestionImage(product),
      quantity: 1,
      color: null,
      size: null,
    })
  }

  const handleBuyNow = () => {
    // Check if cart is empty first
    // if (cart.length === 0) {
    //   toast.error("Your cart is empty");
    //   return;
    // }

    // Prepare cart data for buy-now page
    const cartData = {
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image || "/placeholder.svg",
        quantity: item.quantity,
        color: item.color || "",
        size: item.size || "",
        type: item.type || "hardware",
        packSize: item.packSize || null,
        validityYears: item.validityYears || null,
        maxDevices: item.maxDevices || null,
        validity: item.validity || null
      })),
      subtotal: subtotal,
      tax: tax,
      shipping: shipping,
      total: total
    }

    // Create URL parameters
    const params = new URLSearchParams({
      source: "cart",
      cartData: JSON.stringify(cartData)
    })

    // Redirect to buy-now page
    router.push(`/checkout?${params.toString()}`)
  }

  const handleSaveForLater = async (item: { id: string }) => {
    const added = await addToWishlist(item.id)
    if (added) removeFromCart(item.id)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header />
        <main className="flex-grow">
          <div className="container mx-auto px-4 md:px-8 lg:px-16 py-12">
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
              <p className="text-gray-500 animate-pulse">Loading your cart...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F9FC]">
      <Header />
      <PageTransition>
      <main className="flex-grow">
        <div className="section-container space-y-5 py-5">
          <nav className="flex items-center gap-2 text-[12px] text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#1560BD]">
              Home
            </Link>
            <span className="text-gray-300">›</span>
            <span className="font-medium text-gray-700">Shopping Cart</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-[24px] font-bold text-[#0F2557]">
                Your Cart ({cart.length} {cart.length === 1 ? "item" : "items"})
              </h1>
              <p className="mt-0.5 text-[13px] text-slate-600">
                Good choices! You&apos;re just a few steps away from a better tomorrow.
              </p>
            </div>
            <ol className="flex flex-wrap items-center gap-2 text-[11px]">
              {CHECKOUT_STEPS.map((label, index) => (
                <li key={label} className="flex items-center gap-2">
                  {index > 0 && <span className="h-px w-5 bg-gray-300" aria-hidden />}
                  <span
                    className={`flex items-center gap-1.5 ${
                      index === 0 ? "font-semibold text-[#1560BD]" : "text-gray-400"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        index === 0 ? "bg-[#1560BD] text-white" : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {cart.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#F4F8FD]">
                <ShoppingCart className="h-11 w-11 text-[#1560BD]" strokeWidth={1.3} />
              </div>
              <h2 className="font-heading text-[20px] font-bold text-[#0F2557]">Your cart is empty</h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-slate-600">
                Browse the latest mobiles, appliances and electronics — there is something for every home.
              </p>
              <Link
                href="/products"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#1560BD] px-7 py-3 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                Start Shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              {/* Cart Items */}
              <div className="space-y-4">
                {/* Select / bulk actions */}
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <label className="flex items-center gap-2.5 text-[13px] font-medium text-[#0F2557]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 accent-[#1560BD]"
                    />
                    Select All ({selectedIds.length}/{cart.length} items)
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveSelected}
                    disabled={selectedIds.length === 0}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-red-500 transition-colors hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>

                <AnimatePresence mode="popLayout">
                {cart.map((item, index) => {
                  const image = Array.isArray(item.image) ? item.image[0] : item.image
                  const mrp = mrpById[item.id]
                  const hasMrp = !!mrp && mrp > item.price
                  const percentOff = hasMrp ? Math.round(((mrp - item.price) / mrp) * 100) : 0
                  const lineSave = hasMrp ? (mrp - item.price) * item.quantity : 0

                  return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      height: 0,
                      scale: 0.97,
                      marginBottom: 0,
                      transition: {
                        opacity: { duration: 0.2 },
                        height: { duration: 0.3, ease: [0.65, 0, 0.35, 1] },
                        scale: { duration: 0.2 },
                      },
                    }}
                    transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                  >
                    <div className="flex gap-3 p-4 sm:gap-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                        aria-label={`Select ${cleanProductName(item.name)}`}
                        className="mt-1 h-4 w-4 flex-shrink-0 accent-[#1560BD]"
                      />

                      <Link href={`/product/${item.id}`} className="flex-shrink-0">
                        <img
                          src={image || "/placeholder.svg?height=128&width=128"}
                          alt={cleanProductName(item.name)}
                          className="h-24 w-24 rounded-lg border border-gray-100 bg-white object-contain p-1.5 sm:h-28 sm:w-28"
                        />
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/product/${item.id}`}>
                              <h3 className="line-clamp-2 text-[14px] font-semibold text-[#0F2557] transition-colors hover:text-[#1560BD]">
                                {cleanProductName(item.name)}
                              </h3>
                            </Link>

                            {item.type === "software" ? (
                              <p className="mt-1 text-[11px] text-slate-500">
                                {item.maxDevices || item.packSize || "Unlimited"} devices ·{" "}
                                {item.validity ||
                                  (item.validityYears
                                    ? `${item.validityYears} Year${item.validityYears > 1 ? "s" : ""}`
                                    : "Lifetime")}
                              </p>
                            ) : (
                              <p className="mt-1 text-[11px] text-slate-500">
                                SKU: <span className="font-mono">{item.id.substring(0, 8)}</span>
                              </p>
                            )}

                            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-green-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
                              In stock
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                              {item.type === "software" ? (
                                <AlertCircle className="h-3.5 w-3.5 text-[#1560BD]" strokeWidth={1.8} />
                              ) : (
                                <Truck className="h-3.5 w-3.5 text-[#1560BD]" strokeWidth={1.8} />
                              )}
                              {item.type === "software"
                                ? "Instant delivery via email after payment"
                                : "Delivered in 7 – 8 business days"}
                            </p>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <p className="font-heading text-[17px] font-bold text-[#0F2557]">
                              ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                            </p>
                            {hasMrp && (
                              <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px]">
                                <span className="text-gray-400 line-through">
                                  ₹{(mrp * item.quantity).toLocaleString("en-IN")}
                                </span>
                                <span className="font-semibold text-green-600">{percentOff}% off</span>
                              </p>
                            )}
                            {lineSave > 0 && (
                              <p className="mt-0.5 text-[11px] font-semibold text-green-600">
                                You save ₹{Math.round(lineSave).toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center overflow-hidden rounded-lg border border-gray-200">
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              aria-label="Decrease quantity"
                              className="px-3 py-1.5 transition-colors hover:bg-gray-50"
                            >
                              <Minus className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                            <span className="w-10 py-1.5 text-center text-[13px] font-semibold text-[#0F2557]">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              aria-label="Increase quantity"
                              className="px-3 py-1.5 transition-colors hover:bg-gray-50"
                            >
                              <Plus className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                          </div>

                          <div className="flex items-center gap-4 text-[12px] font-medium">
                            <button
                              onClick={() => handleSaveForLater(item)}
                              className="flex items-center gap-1.5 text-slate-600 transition-colors hover:text-[#1560BD]"
                            >
                              <Heart className="h-4 w-4" />
                              Move to Wishlist
                            </button>
                            <span className="h-3 w-px bg-gray-200" aria-hidden />
                            <button
                              onClick={() => handleRemoveItem(item.id, item.name)}
                              className="flex items-center gap-1.5 text-slate-600 transition-colors hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  )
                })}
                </AnimatePresence>

                {/* Frequently bought together */}
                {suggestions.length > 0 && (
                  <section className="rounded-xl border border-gray-200 bg-white">
                    <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#F5A623]" />
                        <h2 className="font-heading text-[15px] font-bold text-[#0F2557]">
                          Frequently Bought Together
                        </h2>
                      </div>
                      <Link
                        href="/products"
                        className="flex items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
                      >
                        View All
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </header>
                    <ul className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-3 lg:grid-cols-6">
                      {suggestions.map((product) => (
                        <li key={product.id} className="bg-white p-3">
                          <Link href={`/product/${product.slug || product.id}`} className="block">
                            <img
                              src={suggestionImage(product)}
                              alt=""
                              className="mx-auto h-20 w-full object-contain"
                            />
                            <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug text-[#0F2557]">
                              {product.name}
                            </p>
                          </Link>
                          <p className="mt-1.5 font-heading text-[13px] font-bold text-[#0F2557]">
                            ₹{Math.round(Number(product.price) || 0).toLocaleString("en-IN")}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleAddSuggestion(product)}
                            className="mt-2 w-full rounded-lg border border-[#1560BD] py-1.5 text-[11px] font-semibold text-[#1560BD] transition-colors hover:bg-[#1560BD] hover:text-white"
                          >
                            Add to Cart
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* Price details */}
              <div className="space-y-4 lg:sticky lg:top-4">
                <Reveal delay={0.15}>
                <section className="rounded-xl border border-gray-200 bg-white p-5">
                  <h2 className="font-heading text-[15px] font-bold text-[#0F2557]">Price Details</h2>

                  <dl className="mt-4 space-y-2.5 text-[13px]">
                    <div className="flex justify-between">
                      <dt className="text-slate-600">
                        Total MRP ({cart.length} {cart.length === 1 ? "item" : "items"})
                      </dt>
                      <dd className="font-medium text-[#0F2557]">₹{Math.round(totalMrp).toLocaleString("en-IN")}</dd>
                    </div>

                    {savings > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-slate-600">Discount</dt>
                        <dd className="font-semibold text-green-600">
                          −₹{Math.round(savings).toLocaleString("en-IN")}
                        </dd>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <dt className="text-slate-600">Coupon Discount</dt>
                      <dd>
                        <Link href="/checkout" className="text-[12px] font-semibold text-[#1560BD] hover:underline">
                          Apply Coupon
                        </Link>
                      </dd>
                    </div>

                    <div className="flex justify-between">
                      <dt className="text-slate-600">Delivery Charges</dt>
                      <dd className={shipping === 0 ? "font-semibold text-green-600" : "font-medium text-[#0F2557]"}>
                        {shipping === 0 ? "FREE" : `₹${shipping.toLocaleString("en-IN")}`}
                      </dd>
                    </div>

                    {shipping > 0 && (
                      <p className="rounded-lg bg-[#F4F8FD] px-3 py-2 text-[11px] text-[#1560BD]">
                        Add ₹{(1000 - (total - shipping)).toLocaleString("en-IN")} more to qualify for FREE delivery.
                      </p>
                    )}

                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-baseline justify-between">
                        <dt className="font-heading text-[15px] font-bold text-[#0F2557]">Total Amount</dt>
                        <dd className="font-heading text-[18px] font-bold text-[#0F2557]">
                          ₹{total.toLocaleString("en-IN")}
                        </dd>
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-400">Inclusive of all taxes</p>
                    </div>
                  </dl>

                  <button
                    onClick={handleBuyNow}
                    disabled={cart.length === 0}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6A2C] py-3 text-[14px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    Proceed to Checkout
                  </button>

                  {savings > 0 && (
                    <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-center text-[12px] font-semibold text-green-700">
                      You are saving ₹{Math.round(savings).toLocaleString("en-IN")} on this order!
                    </p>
                  )}

                  {!user && (
                    <p className="mt-3 text-center text-[12px] text-slate-500">
                      <Link href="/login?redirect=/cart" className="font-semibold text-[#1560BD] hover:underline">
                        Sign in
                      </Link>{" "}
                      for faster checkout and saved addresses.
                    </p>
                  )}
                </section>
                </Reveal>

                {/* Available offers */}
                <section className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-[15px] font-bold text-[#0F2557]">Available Offers</h2>
                    <Link
                      href="/offers"
                      className="flex items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
                    >
                      View All
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {CART_OFFERS.map(({ title, detail }) => (
                      <li key={title} className="rounded-lg bg-[#F4F8FD] px-3 py-2.5">
                        <p className="text-[12px] font-semibold text-[#0F2557]">{title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{detail}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          )}

          <TrustStrip />
        </div>
      </main>
      </PageTransition>
      <Footer />
    </div>
  )
}
