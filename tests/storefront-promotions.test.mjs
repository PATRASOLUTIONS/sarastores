import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"
import { NextRequest } from "next/server.js"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"
import { marketingReadiness } from "../scripts/check-marketing-setup.mjs"

const at = "2026-11-07T10:00:00.000Z"
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [at])) } static now() { return Date.parse(at) } }
const cursor = rows => ({ sort() { return this }, limit(n) { this.n = n; return this }, toArray: async function () { return rows.slice(0, this.n || rows.length) } })
const promoId = new ObjectId()
const promo = { _id: promoId, type: "buy_get_product", code: "BOX30", name: "Phone box offer", active: true,
  giftId: "BOX-30", buyQty: 1, getQty: 1, applyScope: "skus", skus: ["PHONE-1"],
  startDate: "2026-11-05T00:00:00+05:30", endDate: "2026-11-12T23:59:59.999+05:30", giftAutoAdd: false }
const gift = { _id: "BOX-30", sku: "BOX-30", name: "30 Box", photo: "https://fixture.invalid/box.jpg", price: 30, mrp: 50, active: true }
const config = { enabled: true, consentVersion: "fixture-v1", campaignStart: "2026-11-05", campaignEnd: "2026-11-12", registrationStart: "2026-11-05", registrationEnd: "2026-11-10" }
const item = { id: "PHONE", name: "Phone", image: "/phone.png", price: 26000, quantity: 1, sku: "PHONE-1", division: "Mobile", type: "hardware" }

function fixture(options = {}) {
  const promotions = options.promotions || [promo]
  const coupons = [...promotions, ...(options.coupons || [])]
  const calls = []
  const loader = sourceLoader({
    "@/lib/db-service": { COLLECTIONS: { COUPONS: "coupons", PRODUCTS: "products" }, getCollection: async name => {
      if (name === "coupons") return { find: query => cursor(coupons.filter(row => row.active && (!query.type || row.type === query.type))) }
      if (name === "gift_items") return { find: () => cursor(options.gifts || [gift]) }
      if (name === "products") return { find: query => { calls.push(["discovery", query]); return cursor(options.candidates || [{ _id: "PHONE" }]) } }
      throw new Error(`Unexpected database operation: ${name}`)
    } },
    "@/lib/diwali/service": { getConfig: async () => ({ ...config, ...options.config }) },
    "@/lib/diwali/blocklist": { isDiwaliCustomerBlocked: async customer => { calls.push(["customer", customer]); return !!options.blocked } },
    "@/lib/public-catalogue": { getPublicCatalogueSelection: async () => ({ ids: ["PHONE"] }) },
    "@/lib/order-pricing": {
      priceCatalogueCart: async raw => {
        calls.push(["price", raw])
        if (options.unavailable) return { ok: false, error: "Out of stock" }
        const priced = { ...item, ...options.item }
        return { ok: true, items: [priced], catalogue: new Map([[priced.id, { ...priced, active: true, stock: 2, slug: "phone", ...options.product }]]) }
      },
      computeCouponDiscount: async (code, items, catalogue, userId) => {
        calls.push(["coupon", code, items[0].price, userId])
        return options.discount ? { ok: true, coupon: { name: "Save on phone", code, discount: options.discount } } : { ok: false, error: "Not applicable" }
      },
    },
  }, { context: { Date: FixedDate } })
  return { ...loader.load("lib/storefront-promotions.ts"), loader, calls }
}

test("one phone combines its scoped optional box gift and exact silver tier without changing checkout awards", async () => {
  const f = fixture()
  const result = await f.getStorefrontPromotions("PHONE", null)
  assert.equal(result.products.length, 1)
  const [box, silver] = result.products[0].benefits
  assert.equal(box.name, "30 Box")
  assert.equal(box.selectionRequired, true)
  assert.equal(box.expiresAt, "2026-11-12T18:29:59.999Z")
  assert.equal(silver.name, "10 Gram Silver")
  assert.equal(silver.expiresAt, "2026-11-10T18:29:59.999Z", "Earliest purchase/registration closing date applies")
  assert.equal(result.products[0].href, "/product/phone")
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call[0] === "price")[1])), [{ id: "PHONE", quantity: 1 }])
  const awards = await f.loader.load("lib/gift-promotions.ts").quoteGiftPromotions([item], null, [], undefined, [String(promoId)])
  assert.equal(awards.length, 1)
  assert.equal("expiresAt" in awards[0], false, "Checkout award contract remains unchanged")
})

test("Diwali preview follows all tier boundaries, including whole-rupee and gold rules", async () => {
  for (const [price, expected] of [[14999, null], [15000, "5 Gram Silver"], [25999, "5 Gram Silver"], [26000, "10 Gram Silver"],
    [50000, "10 Gram Silver"], [50001, "15 Gram Silver"], [80001, "20 Gram Silver"], [100000, "20 Gram Silver"], [100001, "1 Gram Gold"], [15000.5, null]]) {
    const result = await fixture({ promotions: [], item: { price } }).getStorefrontPromotions("PHONE", null)
    assert.equal(result.products[0]?.benefits.find(benefit => benefit.kind === "diwali")?.name || null, expected, String(price))
  }
})

test("unavailable and private products never advertise gifts", async () => {
  for (const options of [{ unavailable: true }, { product: { active: false } }, { product: { disabled: true } }, { item: { type: "service" } }]) {
    assert.equal((await fixture(options).getStorefrontPromotions("PHONE", null)).products.length, 0)
  }
})

test("disabled, future and ended Diwali windows are excluded", async () => {
  for (const config of [{ enabled: false }, { campaignStart: "2026-11-08" }, { registrationStart: "2026-11-08" },
    { campaignEnd: "2026-11-06" }, { registrationEnd: "2026-11-06" }]) {
    assert.equal((await fixture({ config, promotions: [] }).getStorefrontPromotions("PHONE", null)).products.length, 0)
  }
})

test("blocked customer identity comes from the session and suppresses Diwali without removing unrelated gifts", async () => {
  const f = fixture({ blocked: true })
  const result = await f.getStorefrontPromotions("PHONE", { user: { id: "customer", email: "fixture@example.invalid", phone: "9999999999" } })
  assert.deepEqual(Array.from(result.products[0].benefits, benefit => benefit.kind), ["gift"])
  assert.equal(f.calls.find(call => call[0] === "customer")[1].email, "fixture@example.invalid")
})

test("gift scope, start/end dates, inactive gifts, quantities and usage/customer limits are enforced by the shared rules", async () => {
  for (const patch of [{ active: false }, { startDate: "2026-11-08" }, { endDate: "2026-11-06" }, { skus: ["TV-1"] },
    { applyScope: "products", productIds: ["OTHER"] }, { applyScope: "divisions", divisions: ["Television"] },
    { buyQty: 2 }, { usageLimit: 1, usageCount: 1 }, { perCustomerLimit: 1 }]) {
    const result = await fixture({ config: { enabled: false }, promotions: [{ ...promo, ...patch }] }).getStorefrontPromotions("PHONE", null)
    assert.equal(result.products.length, 0, JSON.stringify(patch))
  }
  const result = await fixture({ config: { enabled: false }, gifts: [] }).getStorefrontPromotions("PHONE", null)
  assert.equal(result.products.length, 0)
})

test("multiple matching gifts combine; coupons stay alternatives and report their lower Diwali tier", async () => {
  const f = fixture({ promotions: [promo, { ...promo, _id: new ObjectId(), code: "SECOND", giftAutoAdd: true }],
    coupons: [{ _id: new ObjectId(), active: true, code: "SAVE", name: "Save", type: "fixed", noEndDate: true }], discount: 12000 })
  const product = (await f.getStorefrontPromotions("PHONE", null)).products[0]
  assert.equal(product.benefits.filter(benefit => benefit.kind === "gift").length, 2)
  assert.equal(product.benefits.filter(benefit => benefit.kind === "gift" && !benefit.selectionRequired).length, 1)
  const coupon = product.benefits.find(benefit => benefit.kind === "coupon")
  assert.match(coupon.description, /Choose one coupon/)
  assert.match(coupon.description, /After this coupon: no Diwali gift eligibility/)
  assert.equal(product.price, 26000)
  assert.equal(f.calls.filter(call => call[0] === "price").length, 1, "Discounts reuse the authoritative priced cart")
})

test("discovery is bounded, deduplicates products and skips discovery with no enabled promotions", async () => {
  const f = fixture({ candidates: [{ _id: "PHONE" }, { _id: "PHONE" }] })
  assert.equal((await f.getStorefrontPromotions(null, null)).products.length, 1)
  assert.equal(f.calls.filter(call => call[0] === "price").length, 1)
  const none = fixture({ config: { enabled: false }, promotions: [] })
  assert.equal((await none.getStorefrontPromotions(null, null)).products.length, 0)
  assert.equal(none.calls.length, 0)
})

test("open-page offers expire and unverified snapshots hide even when the campaign has no end date", () => {
  const { visiblePromotionProducts, storefrontPromotionsSchema } = sourceLoader().load("lib/storefront-promotion-types.ts")
  const start = Date.parse(at)
  const snapshot = storefrontPromotionsSchema.parse({ verifiedAt: at, products: [{ id: "PHONE", name: "Phone", image: null, price: 26000, href: "/product/phone",
    benefits: [{ id: "gift", name: "Box", kind: "gift", quantity: 1, photo: null, description: "Gift", selectionRequired: false, expiresAt: new Date(start + 5000).toISOString() }] }] })
  assert.equal(visiblePromotionProducts(snapshot, start + 4999).length, 1)
  assert.equal(visiblePromotionProducts(snapshot, start + 5001).length, 0)
  snapshot.products[0].benefits[0].expiresAt = null
  assert.equal(visiblePromotionProducts(snapshot, start + 45001).length, 0)
  assert.equal(visiblePromotionProducts(snapshot, start - 1).length, 0)
})

test("large TPIN lists use a bounded discovery query instead of exceeding MongoDB document limits", async () => {
  const f = fixture({ promotions: [{ ...promo, skus: Array.from({ length: 10000 }, (_, index) => `ITEM-${index}`) }] })
  await f.getStorefrontPromotions(null, null)
  const query = f.calls.find(call => call[0] === "discovery")[1]
  const serialized = JSON.stringify(query)
  assert.ok(serialized.length < 200000)
  assert.match(serialized, /\$getField/, "Literal Excel Item No. identifiers use the shared stock filter")
  assert.doesNotMatch(serialized, /ITEM-9999/)
})

test("entry invitation excludes checkout, privileged and product flows", () => {
  const { isPromotionEntryPath } = sourceLoader().load("lib/storefront-promotion-types.ts")
  for (const path of ["/", "/products", "/category/mobile", "/brands/apple", "/offers"]) assert.equal(isPromotionEntryPath(path), true, path)
  for (const path of [null, "/admin/products", "/checkout", "/cart", "/account", "/product/phone", "/diwali-gift/status", "/orders", "/login", "/offers-private"]) assert.equal(isPromotionEntryPath(path), false, path)
})

test("public API rejects forged identity/money and returns customer-specific no-store quotes", async () => {
  let calls = 0
  const user = { user: { id: "session-customer" } }
  const route = sourceLoader({
    "@/lib/rate-limit": { withRateLimit: fn => fn },
    "@/lib/auth": { getSession: async () => user },
    "@/lib/storefront-promotions": { getStorefrontPromotions: async (id, session) => { calls++; assert.equal(id, "PHONE"); assert.equal(session, user); return { verifiedAt: at, products: [] } } },
  }).load("app/api/storefront-promotions/route.ts")
  for (const query of ["productId=PHONE&userId=other", "productId=PHONE&price=1", "productId=", "productId=PHONE&productId=OTHER", "productId=%00"]) {
    assert.equal((await route.GET(new NextRequest(`https://fixture.invalid/api/storefront-promotions?${query}`))).status, 400)
  }
  assert.equal(calls, 0)
  const response = await route.GET(new NextRequest("https://fixture.invalid/api/storefront-promotions?productId=PHONE"))
  assert.equal(response.status, 200)
  assert.match(response.headers.get("cache-control"), /private, no-store/)
  assert.equal(response.headers.get("vary"), "Cookie")
})

test("inline gift section shows one gift label and its deadline, with longer conditions moved behind Gift Terms", async () => {
  const products = (await fixture({ gifts: [{ ...gift, name: "Premium Mobile Gift Box With Accessories" }] }).getStorefrontPromotions("PHONE", null)).products
  const Component = sourceLoader({
    "@/hooks/useStorefrontPromotions": { useStorefrontPromotions: () => ({ products }) },
  }).load("components/promotions/PromotionExperience.tsx").default
  const html = renderToStaticMarkup(Component ? (await import("react")).createElement(Component, { productId: "PHONE" }) : null)
  assert.match(html, /id="product-gifts"/)
  assert.match(html, />Premium Mobile Gift…<\/p>/)
  assert.match(html, /10 Gram Silver/)
  assert.doesNotMatch(html, /Select this gift in cart|payment confirmation and gift approval|Preview for one unit|Preview gifts|Diwali eligibility before coupons/)
  assert.match(html, /Gift Terms\*/)
  assert.match(html, /href="\/gift-terms\?productId=PHONE"/)
  assert.match(html, /Valid till 12 Nov 2026\./)
  assert.doesNotMatch(html, /11:59|pm IST|am IST/)
  assert.equal(Array.from(html.matchAll(/<p[^>]*>10 Gram Silver<\/p>/g)).length, 1)
  assert.doesNotMatch(html, /role="dialog"/, "Popup waits for client session/consent before opening")
})

test("promotion measurement emits nothing without analytics consent", () => {
  let granted = false, requests = 0
  const browser = { dataLayer: [], location: { pathname: "/product/phone" } }
  const { track } = sourceLoader({ "@/lib/consent-client": { hasConsent: () => granted } }, { context: {
    window: browser, document: { referrer: "" }, Blob, navigator: { sendBeacon: () => { requests++; return true } },
  } }).load("lib/analytics.ts")
  track("view_promotion", { promotion_id: "box" })
  assert.equal(browser.dataLayer.length, 0)
  assert.equal(requests, 0)
  granted = true
  track("select_promotion", { promotion_id: "box" })
  assert.equal(browser.dataLayer.length, 1)
  assert.equal(requests, 1)
})

test("marketing setup selects one Google installation and reports missing or unverified tags without leaking values", () => {
  const report = marketingReadiness({ NEXT_PUBLIC_GTM_ID: "GTM-ABC", NEXT_PUBLIC_GA_ID: "G-ABC", GOOGLE_MERCHANT_CLIENT_SECRET: "private-fixture-value" })
  assert.equal(report.checks.find(row => row.area === "GA4 / GTM").status, "configured_unverified")
  assert.equal(report.checks.find(row => row.area === "GA4 / GTM").mode, "direct")
  assert.doesNotMatch(JSON.stringify(report), /private-fixture-value|GTM-ABC|G-ABC/)
  assert.equal(marketingReadiness({ NEXT_PUBLIC_GTM_ID: "GTM-ABC" }).checks.find(row => row.area === "GA4 / GTM").status, "configured_unverified")
})
