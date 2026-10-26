"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { z } from "zod"
import { toast } from "react-hot-toast"
import { ArrowRight, Calendar, CheckCircle2, Crown, Heart, Lock, Mail, Package, Phone, Tag, Truck, User, X, XCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/hooks/useCart"
import { useWishlist } from "@/hooks/useWishlist"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { apiFetch } from "@/lib/api-client"
import { cleanProductName, toastProductName } from "@/utils/cleanProductName"
import CartProductImage from "@/components/CartProductImage"
import SavedAddresses from "@/components/account/SavedAddresses"
import { dateOfBirthSchema } from "@/lib/validation"
import styles from "./dashboard.module.css"

const productSchema = z.object({
  id: z.string(), name: z.string(), price: z.number().finite().positive(), mrp: z.number().finite().nullish(),
  image: z.string().nullish(), images: z.array(z.string()).optional(), slug: z.string().optional(),
  stock: z.number().finite().optional(), active: z.boolean().optional(),
})
type ViewedProduct = z.infer<typeof productSchema>
const orderSchema = z.object({
  id: z.string(), orderId: z.string().nullish(), total: z.number().finite(), status: z.string(), createdAt: z.string(),
  items: z.array(z.object({ id: z.string().optional(), name: z.string(), image: z.string().nullish() })),
})
type RecentOrder = z.infer<typeof orderSchema>
const inr = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
const formatDate = (value?: string | null) => {
  if (!value) return ""
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}
const imageOf = (product: ViewedProduct) => product.image || product.images?.[0] || "/placeholder.svg"
const STORAGE_TOKEN = /(?:\(\s*)?\d+(?:\.\d+)?\s*(?:MB|GB|TB)(?:\s*\+\s*\d+(?:\.\d+)?\s*(?:MB|GB|TB))?(?:\s*\))?/i
function modelOf(name: string) {
  const clean = cleanProductName(name).replace(/\s+/g, " ").trim()
  const match = STORAGE_TOKEN.exec(clean)
  const family = match && match.index >= 4 ? clean.slice(0, match.index) : clean
  return family.replace(/[\s(,/-]+$/, "").trim()
}
const PERKS = [
  { icon: Package, label: "Track Orders Easily" }, { icon: Heart, label: "Save Your Favourites" },
  { icon: Tag, label: "Get Exclusive Offers" }, { icon: Crown, label: "Enjoy Member Benefits" },
]
function OrderStatus({ status }: { status: string }) {
  const value = status.toLowerCase().replace(/[_-]/g, " ")
  const settled = ["delivered", "collected"].includes(value)
  const cancelled = ["cancelled", "returned", "refunded"].includes(value)
  const Icon = cancelled ? XCircle : settled ? CheckCircle2 : value.includes("ship") || value === "out for delivery" ? Truck : Package
  return <span className={`${styles.status} ${cancelled ? styles.cancelled : settled ? styles.delivered : styles.processing}`}>
    <Icon size={11} />{value.replace(/\b\w/g, letter => letter.toUpperCase())}
  </span>
}
function Detail({ icon: Icon, label, value, action }: { icon: typeof User; label: string; value: string; action?: ReactNode }) {
  return <div className={`${styles.detail}${action ? ` ${styles.password}` : ""}`}>
    <dt><Icon size={22} aria-hidden="true" /><span>{label}</span></dt>
    <dd><span>{value}</span>{action}</dd>
  </div>
}

export default function DashboardPage() {
  const { user, updateProfile, isLoading: authLoading } = useAuth()
  const { cart, isLoading: cartLoading, addToCart } = useCart()
  const { isInWishlist, addToWishlist, removeFromWishlist, isLoading: wishlistLoading } = useWishlist()
  const [orders, setOrders] = useState<RecentOrder[]>([])
  const [orderLoading, setOrderLoading] = useState(true)
  const [orderError, setOrderError] = useState("")
  const [orderAttempt, setOrderAttempt] = useState(0)
  const [products, setProducts] = useState<ViewedProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState("")
  const [productsAttempt, setProductsAttempt] = useState(0)
  const [offers, setOffers] = useState<ViewedProduct[]>([])
  const [offersLoading, setOffersLoading] = useState(true)
  const [offersError, setOffersError] = useState("")
  const [offersAttempt, setOffersAttempt] = useState(0)
  const [adding, setAdding] = useState<string | null>(null)
  const [wishing, setWishing] = useState<string | null>(null)
  const [profileDraft, setProfileDraft] = useState<{ name: string; phone: string; dateOfBirth: string;
    street: string; city: string; state: string; zip: string; country: string } | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const lock = useSubmitLock()
  const profileDialog = useRef<HTMLDialogElement>(null)
  const accountId = user?.id
  const ownerRef = useRef(accountId)
  ownerRef.current = accountId
  useEffect(() => { setProfileDraft(null) }, [accountId])

  useEffect(() => {
    if (authLoading) return
    setOrders([])
    setOrderError("")
    if (!accountId) { setOrderLoading(false); return }
    const controller = new AbortController()
    const load = async () => {
      setOrderLoading(true)
      try {
        const response = await apiFetch(`/api/orders?userId=${encodeURIComponent(accountId)}&limit=5`, { signal: controller.signal })
        if (!response.ok) throw new Error("Recent orders could not be loaded.")
        const parsed = z.array(orderSchema).parse(await response.json())
        if (!controller.signal.aborted) setOrders(parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3))
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Dashboard] Recent orders failed:", error)
        setOrderError("Recent orders could not be loaded. Please retry.")
      } finally { if (!controller.signal.aborted) setOrderLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [accountId, authLoading, orderAttempt])

  useEffect(() => {
    if (authLoading) return
    setProducts([])
    setProductsError("")
    if (!accountId || cart.length === 0) { setProductsLoading(false); return }
    const controller = new AbortController()
    const seeds = cart.slice(0, 2)
    const load = async () => {
      setProductsLoading(true)
      try {
        const lists = await Promise.all(seeds.map(async item => {
          const query = modelOf(item.name).split(/\s+/).slice(0, 4).join(" ")
          if (!query) return []
          const response = await fetch(`/api/products?fields=card&limit=30&search=${encodeURIComponent(query)}`, { signal: controller.signal })
          if (!response.ok) throw new Error("Recommended products could not be loaded.")
          return z.array(productSchema).parse(await response.json())
        }))
        if (controller.signal.aborted) return
        const inCart = new Set(cart.map(item => item.id))
        const seen = new Set<string>()
        const picks: ViewedProduct[] = []
        lists.forEach((list, index) => {
          const price = Number(seeds[index].price) || 0
          const model = modelOf(seeds[index].name).toLowerCase()
          const ranked = list.filter(product => {
            if (!product.id || inCart.has(product.id) || product.active === false || product.stock === 0) return false
            const productModel = modelOf(product.name).toLowerCase()
            const similarModel = model.length >= 4 && productModel.length >= 4 && (productModel.includes(model) || model.includes(productModel))
            const inRange = price > 0 && product.price >= price * 0.75 && product.price <= price * 1.35
            return similarModel && inRange
          })
          ranked.forEach(product => {
            if (seen.has(product.id) || picks.length >= 8) return
            seen.add(product.id)
            picks.push(product)
          })
        })
        setProducts(picks)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Dashboard] Recommendations failed:", error)
        setProductsError("Recommended products could not be loaded. Please retry.")
      } finally { if (!controller.signal.aborted) setProductsLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [accountId, authLoading, cart, productsAttempt])

  useEffect(() => {
    if (authLoading) return
    setOffers([])
    setOffersError("")
    if (!accountId) { setOffersLoading(false); return }
    const controller = new AbortController()
    const load = async () => {
      setOffersLoading(true)
      try {
        const discounted: ViewedProduct[] = []
        for (let skip = 0; skip < 400 && discounted.length < 16; skip += 200) {
          const response = await fetch(`/api/products?fields=card&limit=200&skip=${skip}`, { signal: controller.signal })
          if (!response.ok) throw new Error("Offer products could not be loaded.")
          const page = z.array(productSchema).parse(await response.json())
          discounted.push(...page.filter(product => product.active !== false && product.price > 0 && (product.mrp ?? 0) > product.price))
          if (page.length < 200) break
        }
        if (controller.signal.aborted) return
        setOffers(discounted.slice(0, 16))
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Dashboard] Offer products failed:", error)
        setOffersError("Offer products could not be loaded. Please retry.")
      } finally { if (!controller.signal.aborted) setOffersLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [accountId, authLoading, offersAttempt])

  useEffect(() => {
    if (profileDraft) profileDialog.current?.showModal()
    else profileDialog.current?.close()
  }, [!!profileDraft])

  const openProfile = () => setProfileDraft({
    name: user?.name || "", phone: user?.phone || "", dateOfBirth: user?.dateOfBirth?.slice(0, 10) || "",
    street: user?.address?.street || "", city: user?.address?.city || "", state: user?.address?.state || "",
    zip: user?.address?.zip || "", country: user?.address?.country || "India",
  })
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profileDraft || !lock.acquire()) return
    const schema = z.object({ name: z.string().trim().min(2, "Enter your full name").max(100),
      phone: z.string().regex(/^$|^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
      dateOfBirth: dateOfBirthSchema })
    const parsed = schema.safeParse(profileDraft)
    if (!parsed.success) { lock.release(); toast.error(parsed.error.issues[0].message); return }
    const owner = accountId
    setProfileSaving(true)
    try {
      const saved = await updateProfile({ ...parsed.data, address: {
        street: profileDraft.street, city: profileDraft.city, state: profileDraft.state, zip: profileDraft.zip, country: profileDraft.country,
      } })
      if (ownerRef.current !== owner) return
      if (saved) { setProfileDraft(null); toast.success("Profile updated successfully") }
    } catch (error) {
      console.error("[Dashboard] Profile update failed:", error)
      toast.error("Profile could not be saved. Please retry.")
    } finally { lock.release(); setProfileSaving(false) }
  }
  const addProduct = async (product: ViewedProduct) => {
    if (adding) return
    setAdding(product.id)
    try {
      const added = await addToCart({ id: product.id, name: product.name, price: product.price,
        image: imageOf(product), stock: product.stock, quantity: 1, color: null, size: null })
      if (added) toast.success(`${toastProductName(product.name)} added to cart`)
    } finally { setAdding(null) }
  }
  const toggleWishlist = async (id: string) => {
    if (wishing) return
    setWishing(id)
    try { if (isInWishlist(id)) await removeFromWishlist(id); else await addToWishlist(id) }
    finally { setWishing(null) }
  }
  if (authLoading && !user) return <p role="status" className={styles.notice}>Loading your account...</p>
  if (!user) return <p role="alert" className={styles.notice}>Please sign in to view your account.</p>

  return <div data-dashboard-overview className={styles.overview}>
    <section className={styles.welcome}>
      <div><h1>Welcome Back, {(user.name || "there").split(" ")[0]}!</h1><p>Good things happen when you shop with SARA.</p>
        <ul>{PERKS.map(({ icon: Icon, label }) => <li key={label}><Icon size={30} /><span>{label}</span></li>)}</ul></div>
      <img src="/images/account-welcome-bag.png" alt="" aria-hidden="true" />
    </section>
    <section className={styles.panel}>
      <header><h2>My Cart</h2><Link href="/dashboard/cart">View Cart <ArrowRight size={13} /></Link></header>
      {cartLoading && cart.length === 0 ? <p role="status" className={styles.notice}>Loading your cart...</p> :
        cart.length === 0 ? <p className={styles.notice}>Your cart is empty. <Link href="/products">Start shopping</Link></p> :
          <ul className={styles.products}>{cart.map(item => <li key={item.id}>
            <Link href={`/product/${encodeURIComponent(item.id)}`}><CartProductImage src={item.image} name={cleanProductName(item.name)} /><strong>{cleanProductName(item.name)}</strong></Link>
            <p><b>{inr(item.price)}</b><span>Qty {item.quantity}</span></p>
          </li>)}</ul>}
    </section>
    {(orderLoading || orderError || orders.length > 0) && <section className={styles.panel}>
      <header><h2>Recent Orders</h2><Link href="/dashboard/orders">View All Orders <ArrowRight size={13} /></Link></header>
      {orderLoading ? <p role="status" className={styles.notice}>Loading recent orders...</p> :
        orderError ? <p role="alert" className={styles.notice}>{orderError} <button type="button" onClick={() => setOrderAttempt(value => value + 1)}>Retry orders</button></p> :
            <ul className={styles.orders}>{orders.map(order => {
              const lead = order.items[0]
              const settled = ["delivered", "collected", "cancelled", "returned", "refunded"].includes(order.status.toLowerCase())
              return <li key={order.id}><span className={styles.orderImage}><CartProductImage src={lead?.image || undefined} name={lead?.name || "Order"} /></span>
                <div><strong>{cleanProductName(lead?.name || "Order")}{order.items.length > 1 && <small> +{order.items.length - 1} more</small>}</strong>
                  <p>Order #{order.orderId || order.id}</p><p>Placed on {formatDate(order.createdAt) || "Date unavailable"}</p>
                  <b>{inr(order.total)}</b><OrderStatus status={order.status} />
                  <Link className={styles.outline} href={`/dashboard/orders/${encodeURIComponent(order.id)}`}>{settled ? "View Details" : "Track Order"}</Link>
                </div></li>
            })}</ul>}
    </section>}
    <section className={styles.panel}>
      <header><h2>Recommended for You</h2><Link href="/products">View All <ArrowRight size={13} /></Link></header>
      {cart.length === 0 ? <p className={styles.notice}>Add a product to your cart to see similar models and prices.</p> :
        productsLoading ? <p role="status" className={styles.notice}>Finding similar products...</p> :
          productsError ? <p role="alert" className={styles.notice}>{productsError} <button type="button" onClick={() => setProductsAttempt(value => value + 1)}>Retry products</button></p> :
            products.length ? <ul className={styles.products}>{products.map(product => <li key={product.id}>
              <button type="button" className={styles.heart} aria-label={`${isInWishlist(product.id) ? "Remove" : "Add"} ${cleanProductName(product.name)} ${isInWishlist(product.id) ? "from" : "to"} wishlist`}
                aria-pressed={isInWishlist(product.id)} disabled={wishlistLoading || wishing !== null} onClick={() => void toggleWishlist(product.id)}>
                <Heart size={17} fill={isInWishlist(product.id) ? "currentColor" : "none"} /></button>
              <Link href={`/product/${encodeURIComponent(product.slug || product.id)}`}><CartProductImage src={imageOf(product)} name={cleanProductName(product.name)} /><strong>{cleanProductName(product.name)}</strong></Link>
              <p><b>{inr(product.price)}</b>{product.mrp && product.mrp > product.price ? <s>{inr(product.mrp)}</s> : null}</p>
              <button type="button" className={styles.outline} disabled={adding !== null || product.stock === 0} onClick={() => void addProduct(product)}>
                {product.stock === 0 ? "Out of Stock" : adding === product.id ? "Adding..." : "Add to Cart"}</button>
            </li>)}</ul> : <p className={styles.notice}>No similar products found for what is in your cart.</p>}
    </section>
    <section className={styles.panel}>
      <header><h2>Our Best Sellers</h2><Link href="/offers">View All Offers <ArrowRight size={13} /></Link></header>
      {offersLoading ? <p role="status" className={styles.notice}>Loading offer products...</p> :
        offersError ? <p role="alert" className={styles.notice}>{offersError} <button type="button" onClick={() => setOffersAttempt(value => value + 1)}>Retry offers</button></p> :
          offers.length ? <ul className={styles.products}>{offers.map(product => <li key={product.id}>
            <button type="button" className={styles.heart} aria-label={`${isInWishlist(product.id) ? "Remove" : "Add"} ${cleanProductName(product.name)} ${isInWishlist(product.id) ? "from" : "to"} wishlist`}
              aria-pressed={isInWishlist(product.id)} disabled={wishlistLoading || wishing !== null} onClick={() => void toggleWishlist(product.id)}>
              <Heart size={17} fill={isInWishlist(product.id) ? "currentColor" : "none"} /></button>
            <Link href={`/product/${encodeURIComponent(product.slug || product.id)}`}><CartProductImage src={imageOf(product)} name={cleanProductName(product.name)} /><strong>{cleanProductName(product.name)}</strong></Link>
            <p><b>{inr(product.price)}</b>{product.mrp && product.mrp > product.price ? <s>{inr(product.mrp)}</s> : null}</p>
            <button type="button" className={styles.outline} disabled={adding !== null || product.stock === 0} onClick={() => void addProduct(product)}>
              {product.stock === 0 ? "Out of Stock" : adding === product.id ? "Adding..." : "Add to Cart"}</button>
          </li>)}</ul> : <p className={styles.notice}>No offer products are available right now.</p>}
    </section>
    <div className={styles.accountDetails}>
      <SavedAddresses />
      <section id="my-details" className={styles.panel}><header><h2>My Details</h2><button type="button" onClick={openProfile}>Edit Details <ArrowRight size={13} /></button></header>
        <dl className={styles.details}>
          <Detail icon={User} label="Name" value={user.name || "Not added"} /><Detail icon={Mail} label="Email" value={user.email} />
          <Detail icon={Phone} label="Phone Number" value={user.phone || "Not added"} />
          <Detail icon={Calendar} label="Date of Birth" value={formatDate(user.dateOfBirth) || "Not added"} />
          <Detail icon={Lock} label="Password" value="••••••••" action={<Link href="/forgot-password">Change Password</Link>} />
        </dl>
      </section>
    </div>
    <section className={styles.membership}><Crown size={38} fill="#ffc400" /><div><h2>Be a SARA Member</h2><p>Explore Sara Coins, membership benefits and rewards for your purchases.</p></div>
      <Link href="/dashboard/membership">My Membership <ArrowRight size={14} /></Link><img src="/images/account-member-gifts.png" alt="" aria-hidden="true" /></section>
    <dialog ref={profileDialog} className={styles.dialog} onCancel={event => { if (profileSaving) event.preventDefault(); else setProfileDraft(null) }}>
      {profileDraft && <form onSubmit={saveProfile}>
        <header><h2>Edit Profile Details</h2><button aria-label="Close profile editor" type="button" disabled={profileSaving} onClick={() => setProfileDraft(null)}><X size={20} /></button></header>
        <fieldset disabled={profileSaving}><label>Full name<input name="profileName" value={profileDraft.name} onChange={event => setProfileDraft({ ...profileDraft, name: event.target.value })} required /></label>
          <label>Email<input value={user.email} disabled /></label>
          <label>Mobile number<input name="profilePhone" type="tel" value={profileDraft.phone} onChange={event => setProfileDraft({ ...profileDraft, phone: event.target.value })} /></label>
          <label>Date of birth<input name="profileDob" type="date" max={new Date().toISOString().slice(0, 10)} value={profileDraft.dateOfBirth} onChange={event => setProfileDraft({ ...profileDraft, dateOfBirth: event.target.value })} /></label>
          <h3>Account address</h3>
          {(["street", "city", "state", "zip", "country"] as const).map(field => <label key={field}>{field === "zip" ? "Pincode" : field.charAt(0).toUpperCase() + field.slice(1)}
            <input value={profileDraft[field]} onChange={event => setProfileDraft({ ...profileDraft, [field]: event.target.value })} /></label>)}
          <button type="submit" className={styles.save}>{profileSaving ? "Saving..." : "Save Changes"}</button>
        </fieldset>
      </form>}
    </dialog>
  </div>
}
