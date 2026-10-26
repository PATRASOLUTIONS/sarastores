"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, CreditCard, Headphones, Minus, Percent, Plus, ShieldCheck, ShoppingCart, Star, Tag, Trash2, Truck } from "lucide-react"
import { toast } from "react-hot-toast"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CartProductImage from "@/components/CartProductImage"
import { useCart } from "@/hooks/useCart"
import { useWishlist } from "@/hooks/useWishlist"
import { useSettingsData } from "@/hooks/useSettingsData"
import { cleanProductName } from "@/utils/cleanProductName"
import { isOfferLive } from "@/lib/offer-sections"
import styles from "@/app/cart/cart.module.css"
import { cartLimitError } from "@/lib/cart-limits"
import { cartLineKey } from "@/lib/cart-line"
import { purchaseStock, MAX_PURCHASE_QUANTITY } from "@/lib/purchase-validation"
import { bannerGradient, bannerIsPhotoOnly, useBanners } from "@/hooks/useBanners"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { MarketingStatus } from "@/components/marketing/MarketingSections"
import CartGifts from "@/components/cart/CartGifts"
import { useCartGifts } from "@/hooks/useCartGifts"
import { useAuth } from "@/contexts/AuthContext"

type Product = {
  id: string
  name: string
  price: number
  mrp?: number
  stock?: number
  image?: string
  slug?: string
  sku?: string
}
type Offer = { id: string; name: string; description?: string; section?: string; active?: boolean; endsAt?: string }
const STEPS = ["Cart", "Address", "Payment", "Place Order"]
const BENEFITS = [
  { icon: Truck, title: "Delivery Options", detail: "Across Karnataka", href: "/shipping-policy" },
  { icon: ShieldCheck, title: "Genuine Products", detail: "From Trusted Brands", href: "/warranty" },
  { icon: CreditCard, title: "Easy EMI", detail: "Available at Checkout", href: "/emi" },
  { icon: Headphones, title: "Expert Assistance", detail: "In-Store & Online", href: "/contact" },
]
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
const isProduct = (value: unknown): value is Product => {
  if (!value || typeof value !== "object") return false
  const product = value as Partial<Product>
  return typeof product.id === "string" && typeof product.name === "string" &&
    typeof product.price === "number" && Number.isFinite(product.price)
}

export default function CartContents({ embedded = false }: { embedded?: boolean }) {
  const marketing = useMarketingContent("cart")
  const { cart, addToCart, updateQuantity, refreshItemPrices, removeFromCart, isLoading } = useCart()
  const { user } = useAuth()
  const { addToWishlist, isInWishlist } = useWishlist()
  const { data: settings, error: settingsError, isLoading: settingsLoading } = useSettingsData()
  const router = useRouter()
  const promotion = useBanners("cart-promo")[0]
  const [products, setProducts] = useState<Record<string, Product>>({})
  const [detailsError, setDetailsError] = useState("")
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const giftQuote = useCartGifts(embedded ? [] : cart, user?.id || "guest")
  const knownIds = useRef(new Set<string>())
  const selectAll = useRef<HTMLInputElement>(null)
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [merchandisingError, setMerchandisingError] = useState("")
  const [merchandisingLoading, setMerchandisingLoading] = useState(true)
  const [pendingWishlist, setPendingWishlist] = useState<string[]>([])
  const [adding, setAdding] = useState<string[]>([])
  const idsKey = JSON.stringify([...new Set(cart.filter((item) => item.type !== "software").map((item) => item.id))].sort())

  useEffect(() => {
    const ids = cart.map(cartLineKey)
    const added = ids.filter((id) => !knownIds.current.has(id))
    knownIds.current = new Set(ids)
    setSelectedIds((previous) => [...previous.filter((id) => ids.includes(id)), ...added])
  }, [cart])

  const allSelected = cart.length > 0 && selectedIds.length === cart.length
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selectedIds.length > 0 && !allSelected
  }, [allSelected, selectedIds.length, isLoading])

  useEffect(() => {
    const ids: string[] = JSON.parse(idsKey)
    if (ids.length === 0) { setProducts({}); setDetailsError(""); return }
    const controller = new AbortController()
    const load = async () => {
      setDetailsLoading(true)
      setDetailsError("")
      try {
        const response = await fetch("/api/products/bulk", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, compare: true }), signal: controller.signal,
        })
        if (!response.ok) throw new Error("Product prices and availability could not be refreshed. Please try again.")
        const data: unknown = await response.json()
        if (!Array.isArray(data) || !data.every(isProduct)) throw new Error("Invalid product information received.")
        if (!controller.signal.aborted) {
          setProducts(Object.fromEntries(data.map((product) => [product.id, product])))
          refreshItemPrices(Object.fromEntries(data.map((product) => [product.id, product.price])),
            Object.fromEntries(data.filter((product) => typeof product.stock === "number").map((product) => [product.id, product.stock!])))
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Cart] Product details failed:", error)
        setDetailsError(error instanceof Error ? error.message : "Product information is temporarily unavailable.")
      } finally {
        if (!controller.signal.aborted) setDetailsLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [idsKey, attempt, refreshItemPrices])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setMerchandisingLoading(true)
      setMerchandisingError("")
      try {
        const [productResponse, offerResponse] = await Promise.all([
          fetch("/api/products?fields=card&limit=1000", { signal: controller.signal }),
          fetch("/api/offers?live=true", { signal: controller.signal }),
        ])
        if (!productResponse.ok || !offerResponse.ok) throw new Error("Recommendations and offers are temporarily unavailable.")
        const [productData, offerData]: [unknown, unknown] = await Promise.all([productResponse.json(), offerResponse.json()])
        if (!Array.isArray(productData) || !productData.every(isProduct) ||
          !offerData || typeof offerData !== "object" || !("offers" in offerData) || !Array.isArray(offerData.offers)) {
          throw new Error("Invalid recommendations or offers response.")
        }
        const liveOffers = offerData.offers.filter((offer): offer is Offer =>
          !!offer && typeof offer === "object" && typeof offer.id === "string" && typeof offer.name === "string" && isOfferLive(offer))
        if (!controller.signal.aborted) {
          setSuggestions(productData.filter((product) => product.price > 0 && typeof product.stock === "number" && product.stock > 0))
          setOffers(liveOffers.slice(0, 3))
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Cart] Merchandising failed:", error)
        setMerchandisingError(error instanceof Error ? error.message : "Recommendations are temporarily unavailable.")
      } finally {
        if (!controller.signal.aborted) setMerchandisingLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt])

  const totals = useMemo(() => {
    let gross = 0
    let hardwareGross = 0
    let savings = 0
    for (const item of cart) {
      const price = products[item.id]?.price ?? item.price
      const line = price * item.quantity
      gross += line
      if (item.type !== "software") hardwareGross += line
      const mrp = products[item.id]?.mrp
      if (typeof mrp === "number" && Number.isFinite(mrp) && mrp > price) savings += (mrp - price) * item.quantity
    }
    const fee = Number(settings?.shippingFee ?? 99)
    const threshold = Number(settings?.freeShippingThreshold ?? 1000)
    const validShipping = !settingsLoading && !settingsError && !!settings &&
      Number.isFinite(fee) && fee >= 0 && Number.isFinite(threshold) && threshold >= 0
    const shipping = hardwareGross > 0 && hardwareGross < threshold ? fee : 0
    return { gross, savings, mrp: gross + savings, shipping, total: gross + shipping, validShipping }
  }, [cart, products, settings, settingsLoading, settingsError])

  const unavailable = cart.some((item) => {
    const quantity = cart.filter(line => line.id === item.id).reduce((sum, line) => sum + line.quantity, 0)
    if (item.type === "software") return typeof item.stock === "number" && item.stock < quantity
    const product = products[item.id]
    return !detailsLoading && !detailsError && (!product || product.price <= 0 ||
      (purchaseStock(product) ?? 0) < quantity)
  })
  const limitError = cartLimitError(cart.map((item) => ({ ...item, price: products[item.id]?.price ?? item.price })))
  const checkoutBlocked = cart.length === 0 || !!limitError || unavailable
  const proceedToCheckout = () => {
    if (checkoutBlocked) return
    if (detailsLoading || settingsLoading) {
      toast.error("Prices and delivery charges are still loading. Please try again in a moment.")
      return
    }
    if (detailsError) {
      toast.error("Product prices could not be refreshed. Select Retry product details before continuing.")
      return
    }
    if (!totals.validShipping) {
      toast.error("Shipping charges are temporarily unavailable. Refresh the page before continuing.")
      return
    }
    if (unavailable) { toast.error("Remove unavailable items or reduce their quantity before checkout."); return }
    router.push("/checkout")
  }
  const rail = suggestions.filter((product) => !cart.some((item) => item.id === product.id)).slice(0, 6)

  const removeItem = (id: string) => { removeFromCart(id); toast.success("Item removed from cart") }
  const moveToWishlist = async (id: string) => {
    const item = cart.find(item => cartLineKey(item) === id)
    if (!item) return
    setPendingWishlist((previous) => [...previous, id])
    try {
      if (isInWishlist(item.id) || await addToWishlist(item.id)) removeFromCart(id)
    } finally {
      setPendingWishlist((previous) => previous.filter((value) => value !== id))
    }
  }
  const addSuggestion = async (product: Product) => {
    setAdding((previous) => [...previous, product.id])
    try {
      const added = await addToCart({ id: product.id, name: product.name, price: product.price, image: product.image || "/placeholder.svg", quantity: 1, color: null, size: null, stock: product.stock })
      if (added) toast.success("Added to cart")
    } finally {
      setAdding((previous) => previous.filter((id) => id !== product.id))
    }
  }
  const ContentTag = embedded ? "div" : "main"

  return <div className={`${styles.page} ${embedded ? styles.embedded : ""}`}>
    {!embedded && <Header />}
    <ContentTag className={styles.container}>
      <MarketingStatus page="cart" />
      <header className={styles.pageHeading}>
        <div><h1>{embedded ? "My Cart" : "Your Cart"} ({cart.length} {cart.length === 1 ? "item" : "items"})</h1>
          {marketing.enabled("intro") && <p>{marketing.text("intro", "description")}</p>}</div>
        <ol className={styles.steps} aria-label="Checkout progress">{STEPS.map((step, index) => <li key={step} aria-current={index === 0 ? "step" : undefined}>
          <span>{index === 0 ? "•" : index + 1}</span><strong>{step}</strong>
        </li>)}</ol>
      </header>

      {isLoading ? <div className={`${styles.message} ${styles.cartLoading}`} role="status">Loading your cart...</div> : cart.length === 0 ? <section className={styles.empty}>
        <ShoppingCart size={55} /><h2>Your cart is empty</h2>{marketing.enabled("intro") && <p>{marketing.text("intro", "emptyDescription")}</p>}
        <Link href={marketing.text("intro", "ctaLink")} className={styles.primaryButton}>{marketing.text("intro", "ctaText")} <ArrowRight size={16} /></Link>
      </section> : <>
        <div className={styles.cartLayout}>
          <section className={styles.items} aria-label="Cart items">
            <div className={styles.bulkActions}>
              <label><input ref={selectAll} type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : cart.map(cartLineKey))} />
                Select All ({cart.length} items)</label>
              <button type="button" disabled={selectedIds.length === 0} onClick={() => {
                selectedIds.forEach((id) => removeFromCart(id)); toast.success("Selected items removed")
              }}><Trash2 size={15} /> Remove</button>
              <span className="sr-only">Selection applies to bulk removal. Checkout includes every cart item.</span>
            </div>
            <ul>{cart.map((item) => {
              const lineKey = cartLineKey(item)
              const otherQuantity = cart.filter(line => line.id === item.id && cartLineKey(line) !== lineKey)
                .reduce((sum, line) => sum + line.quantity, 0)
              const product = products[item.id]
              const price = product?.price ?? item.price
              const mrp = product?.mrp
              const saving = typeof mrp === "number" && Number.isFinite(mrp) && mrp > price ? (mrp - price) * item.quantity : 0
              const percentOff = typeof mrp === "number" && mrp > price ? Math.round((mrp - price) / mrp * 100) : 0
              const stock = item.type === "software" ? item.stock ?? MAX_PURCHASE_QUANTITY : purchaseStock(product || {}) ?? 0
              const limit = Math.max(0, Math.min(stock, item.maxPurchaseQuantity ?? MAX_PURCHASE_QUANTITY) - otherQuantity)
              const available = item.quantity <= limit && (item.type === "software" || !!product && product.price > 0)
              const name = cleanProductName(item.name)
              const href = item.type === "software" ? "/software" : `/product/${encodeURIComponent(product?.slug || item.id)}`
              return <li key={lineKey} className={styles.cartItem}>
                <input type="checkbox" checked={selectedIds.includes(lineKey)} aria-label={`Select ${name}`} onChange={() => setSelectedIds((previous) =>
                  previous.includes(lineKey) ? previous.filter((id) => id !== lineKey) : [...previous, lineKey])} />
                <Link href={href} className={styles.productImage}><CartProductImage src={item.image} name={name} /></Link>
                <div className={styles.itemCopy}>
                  <Link href={href}><h2>{name}</h2></Link>
                  {(item.color || item.size || item.ram || item.storage) && <p>
                    {[item.color && `Color: ${item.color}`, item.size && `Size: ${item.size}`,
                      item.ram && `RAM: ${item.ram}`, item.storage && `Storage: ${item.storage}`].filter(Boolean).join(" · ")}
                  </p>}
                  {item.type === "software" ? <p>{item.validity || (item.validityYears ? `${item.validityYears} years` : "Digital product")}</p> :
                    product?.sku && <p>SKU: {product.sku}</p>}
                  <p className={available ? styles.inStock : styles.stockNotice}>
                    <CheckCircle2 size={12} />{item.type === "software" ? available ? "Digital delivery" : "Unavailable in this quantity" : detailsLoading ? "Checking availability..." : detailsError ? "Availability unavailable" : available ? "In stock" : "Unavailable in this quantity"}
                  </p>
                  <p className={styles.delivery}><Truck size={12} />{item.type === "software" ? "Delivery details confirmed at checkout" : "Delivery confirmed at checkout"}</p>
                </div>
                <div className={styles.quantity} aria-label={`Quantity for ${name}`}>
                  <button type="button" disabled={item.quantity <= 1} aria-label={`Decrease quantity of ${name}`} onClick={() => updateQuantity(lineKey, item.quantity - 1)}><Minus size={12} /></button>
                  <span>{item.quantity}</span>
                  <button type="button" disabled={item.quantity >= limit || detailsLoading} aria-label={`Increase quantity of ${name}`} onClick={() => updateQuantity(lineKey, item.quantity + 1)}><Plus size={12} /></button>
                </div>
                <div className={styles.linePrice}>
                  <strong>{money(price * item.quantity)}</strong>
                  {saving > 0 && <><del>{money((mrp || price) * item.quantity)}</del><span>{percentOff}% off</span><p>You save {money(saving)}</p></>}
                </div>
                <div className={styles.itemActions}>
                  <button type="button" disabled={pendingWishlist.includes(lineKey)} onClick={() => void moveToWishlist(lineKey)}>Move to Wishlist</button>
                  <span aria-hidden="true">|</span><button type="button" onClick={() => removeItem(lineKey)}>Remove</button>
                </div>
              </li>
            })}</ul>
          </section>
          <aside className={styles.summaryColumn}>
            {!embedded && <CartGifts quote={giftQuote} />}
            <section className={styles.summary} aria-labelledby="price-details">
              <h2 id="price-details">Price Details</h2>
              {limitError && <p role="alert" className={styles.error}>{limitError}</p>}
              {(detailsError || (!settingsLoading && !totals.validShipping)) && <p role="alert" className={styles.error}>{detailsError || "Shipping charges are temporarily unavailable. Please refresh to try again."}</p>}
              {detailsError && <button type="button" className={styles.textButton} onClick={() => setAttempt((value) => value + 1)}>Retry product details</button>}
              <dl>
                <div><dt>Total MRP ({cart.length} items)</dt><dd>{money(totals.mrp)}</dd></div>
                <div className={styles.discount}><dt>Discount</dt><dd>− {money(totals.savings)}</dd></div>
                <div><dt>Coupon Discount</dt><dd>At checkout</dd></div>
                <div className={styles.coupon}><dt><Link href="/checkout#checkout-coupon"><Percent size={15} />Apply Coupon</Link></dt></div>
                <div className={styles.shipping}><dt>Delivery Charges</dt><dd className={totals.validShipping && totals.shipping === 0 ? styles.discount : undefined}>
                  {totals.validShipping ? totals.shipping === 0 ? "FREE" : money(totals.shipping) : "Calculating..."}</dd></div>
                <div className={styles.total}><dt>Total Amount<small>Inclusive of all taxes</small></dt><dd>{totals.validShipping ? money(totals.total) : money(totals.gross)}{!totals.validShipping && <small>Before delivery</small>}</dd></div>
              </dl>
              <button type="button" className={styles.primaryButton} disabled={checkoutBlocked} onClick={proceedToCheckout}>Proceed to Checkout <ArrowRight size={16} /></button>
              {unavailable && <p role="alert" className={styles.stockNotice}>You can review checkout. Remove unavailable items or reduce their quantities before placing an order.</p>}
              {totals.savings > 0 && <p className={styles.savings}><Tag size={18} />You are saving {money(totals.savings)} on this order!</p>}
              <p className={styles.summaryNote}>Totals cover all cart items. Coupons and final availability are confirmed at checkout.</p>
            </section>
            <section className={styles.offers} aria-labelledby="available-offers">
              <header><h2 id="available-offers">{marketing.text("recommendations", "offersTitle")}</h2><Link href={marketing.text("recommendations", "offersLink")}>{marketing.text("recommendations", "offersCtaText")} <ArrowRight size={12} /></Link></header>
              {merchandisingLoading ? <p role="status">Loading offers...</p> : offers.length > 0 ? <ul>{offers.map((offer) => <li key={offer.id}>
                <Tag size={19} /><h3>{offer.name}</h3>{offer.description && <p>{offer.description}</p>}<Link href="/offers">View terms</Link>
              </li>)}</ul> : <p>Explore current offers and eligible EMI options at checkout.</p>}
            </section>
          </aside>
        </div>
        {marketing.enabled("recommendations") && <section className={`${styles.recommendations} ${!promotion ? styles.noPromotion : ""}`} aria-labelledby="recommendations-heading">
          <div className={styles.recommendationProducts}>
            <h2 id="recommendations-heading"><Star size={23} fill="#ffb400" color="#ffb400" />{marketing.text("recommendations", "title")}</h2>
            <p>{marketing.text("recommendations", "description")}</p>
            {merchandisingError ? <div role="alert" className={styles.error}>{merchandisingError}<button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div> :
              merchandisingLoading ? <p role="status">Loading recommendations...</p> : rail.length > 0 ? <ul>{rail.map((product) => <li key={product.id}>
                <Link href={`/product/${encodeURIComponent(product.slug || product.id)}`}><CartProductImage src={product.image} name={cleanProductName(product.name)} /><h3>{cleanProductName(product.name)}</h3></Link>
                <strong>{money(product.price)}</strong><button type="button" disabled={adding.includes(product.id)} onClick={() => void addSuggestion(product)}>{adding.includes(product.id) ? "Adding..." : "Add to Cart"}</button>
              </li>)}</ul> : <p>No additional recommendations are available right now. <Link href="/products">Browse products</Link></p>}
          </div>
          {promotion && (bannerIsPhotoOnly(promotion) ? <aside className={styles.shopCard}>
            {promotion.ctaLink ? <Link href={promotion.ctaLink}><img src={promotion.image} alt="" className="block h-auto w-full" /></Link> : <img src={promotion.image} alt="" className="block h-auto w-full" />}
          </aside> : <aside className={styles.shopCard} style={{ ...bannerGradient(promotion), color: promotion.dark ? "#071331" : "#fff" }}>
            {promotion.image && <CartProductImage src={promotion.image} name={promotion.title} />}
            <h3>{promotion.title}</h3>{promotion.subtitle && <p>{promotion.subtitle}</p>}
            {promotion.ctaText && promotion.ctaLink && <Link href={promotion.ctaLink}>{promotion.ctaText} <ArrowRight size={13} /></Link>}
          </aside>)}
        </section>}
      </>}
      {!embedded && marketing.enabled("services") && <section className={styles.benefits} aria-label="Why shop at SARA"><ul>{marketing.items("services", BENEFITS).map(({ icon: Icon, title, detail, href }) => <li key={title}><Link href={href}>
        <Icon strokeWidth={1.6} /><div><strong>{title}</strong><p>{detail}</p></div>
      </Link></li>)}</ul></section>}
    </ContentTag>
    {!embedded && <Footer />}
  </div>
}
