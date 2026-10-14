"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { z } from "zod"
import { ArrowRight, Check, Coins, CreditCard, Gift, Headphones, Home, MessageCircle, Package, Shield, ShoppingBag, Store, Truck } from "lucide-react"
import { toast } from "react-hot-toast"
import { useCart } from "@/hooks/useCart"
import { cleanProductName } from "@/utils/cleanProductName"
import CartProductImage from "@/components/CartProductImage"
import { orderJourneyStage, type OrderConfirmation } from "@/lib/order-confirmation"
import styles from "./OrderSuccess.module.css"

const productSchema = z.object({
  id: z.string(), name: z.string(), price: z.number().finite().positive(),
  image: z.string().optional(), slug: z.string().optional(),
  stock: z.number().finite().positive(), active: z.boolean().optional(),
})
type Recommendation = z.infer<typeof productSchema>
const money = (amount: number) => amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })
function date(value?: string | null) {
  if (!value) return ""
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" :
    parsed.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}

export default function OrderSuccess({ order, guestToken }: { order: OrderConfirmation; guestToken?: string | null }) {
  const { addToCart } = useCart()
  const [suggestions, setSuggestions] = useState<Recommendation[]>([])
  const [suggestionError, setSuggestionError] = useState("")
  const [suggestionAttempt, setSuggestionAttempt] = useState(0)
  const [adding, setAdding] = useState<string | null>(null)
  const pickup = order.fulfilment?.method === "pickup"
  const paid = order.paymentVerification?.verified === true
  const stage = orderJourneyStage(order.status)
  const customer = order.customer
  const name = customer?.firstName || customer?.name?.split(/\s+/)[0] || order.shippingAddress?.name?.split(/\s+/)[0] || "there"
  const address = order.shippingAddress
  const tokenQuery = guestToken ? `?token=${encodeURIComponent(guestToken)}` : ""
  const orderLink = `/order/${encodeURIComponent(order.orderId)}${tokenQuery}`
  const paymentLabel = order.paymentMethod === "cash-on-delivery" ? "Cash on Delivery" :
    order.paymentMethod === "instore" ? "In-store Purchase" :
      ["razorpay", "online"].includes(order.paymentMethod) ? "Online Payment (Razorpay)" :
        order.paymentMethod === "pinelabs" ? "Online Payment (Pine Labs)" :
          order.paymentMethod === "paytm" ? "Online Payment (Paytm)" : order.paymentMethod
  const journey = pickup
    ? ["Order Placed", "Payment Confirmed", "Ready for Pickup", "Collected"]
    : ["Order Placed", "Payment Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"]
  const cancelled = ["cancelled", "refunded"].includes(order.status.toLowerCase())

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setSuggestionError("")
      try {
        const response = await fetch("/api/products?fields=card&limit=20", { signal: controller.signal })
        if (!response.ok) throw new Error("Recommendations could not be loaded.")
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error("Invalid product recommendations received.")
        const products = data.flatMap(value => {
          const result = productSchema.safeParse(value)
          return result.success && result.data.active !== false &&
            !order.items.some(item => (item.id || item.productId) === result.data.id) ? [result.data] : []
        }).slice(0, 5)
        if (!controller.signal.aborted) setSuggestions(products)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Order success] Recommendations failed:", error)
        setSuggestionError("Recommendations are unavailable right now.")
      }
    }
    void load()
    return () => controller.abort()
  }, [order.orderId, suggestionAttempt])

  const addRecommendation = async (product: Recommendation) => {
    if (adding) return
    setAdding(product.id)
    try {
      const added = await addToCart({ ...product, image: product.image || "/placeholder.svg", quantity: 1, color: null, size: null })
      if (added) toast.success(`${cleanProductName(product.name)} added to cart`)
    } finally { setAdding(null) }
  }

  return <div className={styles.container}>
    <div className={styles.top}>
      <section className={styles.banner}>
        <span className={styles.check}><Check size={36} strokeWidth={3} /></span>
        <div><h1>{cancelled ? "Your order details" : `Thank you, ${name}!`}</h1>
          <p>{cancelled ? `Order status: ${order.status}` : "Your order has been placed successfully."}</p>
          <small>{customer?.email ? <>Order updates will be sent to <strong>{customer.email}</strong>.</> : "Keep your order number for future reference."}</small>
        </div>
        <span className={styles.bag} aria-hidden="true"><ShoppingBag size={75} /><Check size={32} /></span>
      </section>
      <section className={styles.orderNumber}><div><small>Order Number</small><strong>{order.orderId}</strong><small>Placed on</small><span>{date(order.createdAt) || "Date unavailable"}</span></div>
        <div><Link className={styles.primary} href={orderLink}>Track Order <ArrowRight size={14} /></Link>
          <Link className={styles.outline} href="/products">Continue Shopping</Link></div>
      </section>
    </div>

    <div className={styles.details}>
      <section className={styles.panel}><h2>Order Summary ({order.items.length} {order.items.length === 1 ? "item" : "items"})</h2>
        <ul className={styles.items}>{order.items.map((item, index) => <li key={`${item.id || item.productId}-${index}`}>
          <span className={styles.itemImage}><CartProductImage src={item.image || undefined} name={cleanProductName(item.name)} /></span>
          <div><strong>{cleanProductName(item.name)}</strong><small>Qty: {item.quantity}</small></div><b>₹{money(item.price * item.quantity)}</b>
        </li>)}</ul>
        <div className={styles.total}><span>{paid ? "Total Paid" : "Order Total"}</span><strong>₹{money(order.total)}</strong></div>
      </section>
      <section className={styles.panel}><h2>{pickup ? "Pickup Details" : "Delivery Details"}</h2>
        <div className={styles.detailRow}><span><Home size={24} /></span><div><strong>{pickup ? order.fulfilment?.storeName || "Selected SARA store" : address?.name || customer?.name}</strong>
          <p>{address?.street || order.fulfilment?.storeAddress}</p><p>{[address?.city, address?.zip, address?.state].filter(Boolean).join(" - ")}</p>
          {customer?.phone && <p>Mobile: {customer.phone}</p>}</div></div>
        <div className={styles.detailRow}><span><Truck size={24} /></span><div><strong>{pickup ? "Collection Method" : "Delivery Method"}</strong>
          <b>{pickup ? "Store Pickup" : "Home Delivery"}</b><p>{pickup ? "We will confirm stock and let you know when your order is ready." : "Delivery timing will be confirmed after your order."}</p></div></div>
        <div className={styles.detailRow}><span><CreditCard size={24} /></span><div><strong>Payment Method</strong><b>{paymentLabel}</b>
          <p>{paid ? "Payment verified" : order.paymentMethod === "cash-on-delivery" ? "Payment due on delivery" : "Payment confirmation pending"}</p></div></div>
        <Link className={styles.manage} href={orderLink}>View order details <ArrowRight size={13} /></Link>
      </section>
    </div>

    <section className={styles.panel}><h2>Order Journey</h2><ol className={styles.journey}>
      {journey.map((label, index) => {
        const effectiveIndex = pickup && index === 3 ? 5 : index
        const completed = index === 0 || index === 1 && paid || index >= 2 && stage >= effectiveIndex && !cancelled
        const recorded = order.timeline?.find(entry => entry.status.toLowerCase() === label.toLowerCase())
        const timestamp = index === 0 ? order.createdAt : index === 1 && paid ? order.paymentVerification?.checkedAt : recorded?.date
        return <li key={label} className={completed ? styles.completed : undefined} aria-current={completed && effectiveIndex === stage ? "step" : undefined}>
          <span role="img" aria-label={completed ? "Completed" : "Pending"}>{completed ? <Check size={12} /> : <i />}</span><strong>{label}</strong>
          <small>{timestamp ? date(timestamp) : completed ? "Completed" : index === 1 && order.paymentMethod === "cash-on-delivery" ? "Due on delivery" : cancelled ? "Not applicable" : "Awaiting update"}</small>
        </li>
      })}
    </ol></section>

    {guestToken && <section className={styles.guest}><strong>Save your private order link</strong><p>This link lets you reopen your guest order. Keep it private.</p>
      <Link href={orderLink}>Open order {order.orderId} <ArrowRight size={13} /></Link>
      <Link href={`/register?email=${encodeURIComponent(customer?.email || "")}`}>Create an account for future purchases</Link>
    </section>}

    <section className={styles.updates}><span><MessageCircle size={28} /></span><div><h2>Stay up to date with your order</h2><p>Track progress, delivery updates and payment status.</p></div>
      <Link className={styles.outline} href={orderLink}>View Order Updates <ArrowRight size={14} /></Link>
    </section>
    <div className={styles.discover}>
      <section className={styles.panel}><h2>You Might Also Like</h2>
        {suggestionError ? <p role="alert" className={styles.recommendationNotice}>{suggestionError} <button type="button" onClick={() => setSuggestionAttempt(value => value + 1)}>Retry recommendations</button></p> :
          suggestions.length ? <ul className={styles.suggestions}>{suggestions.map(product => <li key={product.id}>
            <Link href={`/product/${encodeURIComponent(product.slug || product.id)}`}><CartProductImage src={product.image} name={cleanProductName(product.name)} /><span>{cleanProductName(product.name)}</span></Link>
            <strong>₹{money(product.price)}</strong><button type="button" disabled={adding !== null} onClick={() => void addRecommendation(product)}>{adding === product.id ? "Adding..." : "Add to Cart"}</button>
          </li>)}</ul> : <p className={styles.recommendationNotice}>Explore more products from SARA. <Link href="/products">Browse products <ArrowRight size={13} /></Link></p>}
      </section>
      <section className={styles.rewards}><div><h2>Discover<br /><strong>SARA REWARDS</strong></h2><b>Shop. Earn. Get More.</b>
        <p><Coins size={15} />Earn Sara Coins on eligible orders</p><p><Gift size={15} />Explore membership benefits</p><p><ShoppingBag size={15} />Redeem available Coins at checkout</p>
        <Link className={styles.primary} href="/rewards">Explore Rewards <ArrowRight size={14} /></Link></div><Gift className={styles.rewardGift} size={92} aria-hidden="true" /></section>
    </div>
    <div className={styles.trust}>{[
      { icon: Store, title: "SARA Stores", text: "Across Karnataka", href: "/store-locator" },
      { icon: Shield, title: "Genuine Products", text: "Trusted brands", href: "/warranty" },
      { icon: CreditCard, title: "EMI Options", text: "Subject to eligibility", href: "/emi" },
      { icon: Package, title: "Order Updates", text: "Track your order", href: orderLink },
      { icon: Headphones, title: "Expert Support", text: "We're here to help", href: "/contact" },
    ].map(({ icon: Icon, title, text, href }) => <Link key={title} href={href}><Icon size={28} /><span><strong>{title}</strong><small>{text}</small></span></Link>)}</div>
  </div>
}
