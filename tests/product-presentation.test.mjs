import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"

const product = { id: "fixture", name: "Selected Phone", price: 26000, stock: 5, active: true, image: "/phone.png" }
const offer = { id: "bank", name: "Bank offer", description: "Discount", active: true, payment_method: "card", type: "discount", starts_at: null, ends_at: null, min_amount: null }
const benefit = { id: "silver", name: "10 Gram Silver", kind: "diwali", quantity: 1, photo: null, selectionRequired: false,
  description: "Diwali eligibility before coupons. Final paid merchandise value determines the tier; payment confirmation and gift approval are required.", expiresAt: "2026-11-12T18:29:59.999Z" }
const quoted = { ...product, href: "/product/selected-phone", benefits: [benefit] }

function pageLoader(offers = [], requestedTab = "overview") {
  return sourceLoader({
    react: { ...React, useState: initial => [initial === "overview" ? requestedTab : typeof initial === "function" ? initial() : initial, () => {}],
      useEffect() {}, useMemo: callback => callback(), useCallback: callback => callback },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/navigation": { useRouter: () => ({ push() {} }), useParams: () => ({ slug: "fixture" }) },
    "@/components/Header": () => null, "@/components/Footer": () => null,
    "@/components/ProductSpecificationTabs": () => null, "@/components/ProductReviewsSection": () => null,
    "@/components/promotions/PromotionExperience": () => null,
    "@/components/product/RazorpayOffers": () => null,
    "@/components/marketing/MarketingSections": { MarketingStatus: () => null },
    "@/hooks/useCart": { useCart: () => ({ addToCart() {} }) },
    "@/hooks/useWishlist": { useWishlist: () => ({ isInWishlist: () => false, addToWishlist() {}, removeFromWishlist() {} }) },
    "@/contexts/AuthContext": { useAuth: () => ({ isAuthenticated: false, isLoading: false }) },
    "@/components/product/ProductSaraCare": { __esModule: true, default: () => null,
      useProductSaraCare: () => ({ offer: null, loading: false, selected: null, selectedPlan: null }) },
    "@/hooks/useSettingsData": { useSettingsData: () => ({ data: {} }) },
    "@/hooks/useRazorpayOffers": { useRazorpayOffers: () => ({ offers, isLoading: false, retry() {} }) },
    "@/hooks/useBanners": { useBanners: () => [] },
    "@/hooks/useMarketingContent": { useMarketingContent: () => ({ text: () => "Fixture", enabled: () => false }) },
  })
}

test("no review placeholders or empty Offers, EMI and Reviews tabs appear on a product", () => {
  const Component = pageLoader().load("app/product/[slug]/ProductDetailClient.tsx").default
  const html = renderToStaticMarkup(Component({ initialProduct: product }))
  assert.doesNotMatch(html, /No reviews yet|\(0 reviews\)|product-tab-offers|product-tab-emi|product-tab-reviews/)
  assert.match(html, /product-tab-overview/)
})

test("populated review and bank-offer tabs remain visible; an EMI offer does not invent a bank discount tab", () => {
  const Component = pageLoader([offer]).load("app/product/[slug]/ProductDetailClient.tsx").default
  const html = renderToStaticMarkup(Component({ initialProduct: { ...product, reviews: { average: 4.5, count: 2 } } }))
  assert.match(html, /product-tab-offers/)
  assert.match(html, /product-tab-reviews/)
  assert.match(html, /\(2 reviews\)/)
  assert.doesNotMatch(html, /product-tab-emi/)
  const EmiPage = pageLoader([{ ...offer, name: "EMI plan", type: "emi", payment_method: "emi" }]).load("app/product/[slug]/ProductDetailClient.tsx").default
  const emi = renderToStaticMarkup(EmiPage({ initialProduct: product }))
  assert.match(emi, /product-tab-emi/)
  assert.doesNotMatch(emi, /product-tab-offers|product-tab-reviews/)
})

test("a selected tab falls back to Overview after its offers disappear", () => {
  for (const selected of ["offers", "emi", "reviews"]) {
    const Component = pageLoader([{ ...offer, active: false }], selected).load("app/product/[slug]/ProductDetailClient.tsx").default
    const html = renderToStaticMarkup(Component({ initialProduct: product }))
    assert.match(html, /id="product-panel-overview"/)
    assert.doesNotMatch(html, new RegExp(`id="product-panel-${selected}"`))
  }
})

test("review statistics are fetched even while the Reviews tab is hidden, without showing an empty section", () => {
  let observed
  const loader = sourceLoader({
    react: { ...React, useState: initial => [initial, () => {}], useMemo: callback => callback(), useEffect: callback => callback() },
    swr: { __esModule: true, default: key => { assert.equal(key, "/api/reviews?productId=fixture"); return { data: [{ id: "real-review", rating: 5, content: "Good phone" }], mutate() {} } } },
  })
  const html = renderToStaticMarkup(React.createElement(loader.load("components/ProductReviewsSection.tsx").default, {
    productId: "fixture", productName: "Selected Phone", productImage: "/phone.png", statsOnly: true, onStatsChange: stats => { observed = stats },
  }))
  assert.equal(html, "")
  assert.equal(observed.count, 1)
  assert.equal(observed.rating, 5)
})

test("gift terms preserve the hidden conditions, real deadline and approved Diwali terms link", () => {
  const loader = sourceLoader({ "@/hooks/useStorefrontPromotions": { useStorefrontPromotions: () => ({ products: [quoted], loading: false, error: false }) } })
  const html = renderToStaticMarkup(React.createElement(loader.load("components/promotions/ProductGiftTerms.tsx").default, { productId: "fixture" }))
  assert.match(html, /payment confirmation and gift approval/)
  assert.match(html, /Preview for one unit/)
  assert.match(html, /Valid until 12 Nov 2026, 11:59 pm IST\./)
  assert.match(html, /href="\/diwali-gift\/terms"/)
  assert.match(html, /href="\/product\/selected-phone"/)
})

test("the celebration closes five seconds after opening even if its quoted product refreshes", () => {
  let now = 0, nextId = 0, cursor = 0, closed = 0
  const hooks = [], scheduled = new Map()
  const loader = sourceLoader({ react: { ...React,
    useRef: initial => { const index = cursor++; return hooks[index] ||= { current: initial } },
    useEffect: (effect, deps) => {
      const index = cursor++, previous = hooks[index]
      if (previous && deps.every((value, position) => Object.is(value, previous.deps[position]))) return
      previous?.cleanup?.()
      hooks[index] = { deps, cleanup: effect() }
    },
  } }, { context: { window: {
    setTimeout: (callback, delay) => { const id = ++nextId; scheduled.set(id, { callback, at: now + delay }); return id },
    clearTimeout: id => scheduled.delete(id),
  } } })
  const Component = loader.load("components/promotions/ProductGiftCelebration.tsx").default
  const render = onClose => { cursor = 0; return Component({ product: { ...quoted }, onClose, restoreFocus() {}, children: null }) }
  render(() => { throw new Error("Old callback should have been refreshed") })
  now = 4000
  render(() => closed++)
  assert.equal(scheduled.size, 1)
  const timer = [...scheduled.values()][0]
  assert.equal(timer.at, 5000)
  assert.equal(closed, 0)
  now = 5000
  timer.callback()
  assert.equal(closed, 1)
  for (const hook of hooks) hook?.cleanup?.()
  assert.equal(scheduled.size, 0, "Timer is cleaned up when the dialog unmounts")
})

test("falling decoration contains both silver and gold and respects reduced motion", () => {
  const Component = sourceLoader().load("components/promotions/ProductGiftCelebration.tsx").FallingGiftCoins
  const html = renderToStaticMarkup(React.createElement(Component))
  assert.match(html, /#dfb145/)
  assert.match(html, /#cbd1d8/)
  assert.match(html, /prefers-reduced-motion: reduce/)
  assert.match(html, /aria-hidden="true"/)
  assert.equal(Array.from(html.matchAll(/<svg/g)).length, 24)
})
