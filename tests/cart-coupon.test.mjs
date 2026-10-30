import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"
import { NextRequest } from "next/server.js"

function browser() {
  const entries = new Map()
  const events = new EventTarget()
  return { entries, context: { Event, window: events, localStorage: {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  } } }
}

test("checkout validation requotes an expired coupon without creating a payment or hiding stock failures", async () => {
  const calls = []
  let failure = { ok: false, code: "COUPON_UNAVAILABLE", error: "Coupon expired" }
  const pricing = { items: [{ id: "fixture-product", price: 118 }], total: 118, coupon: null, couponDiscount: 0 }
  const loader = sourceLoader({
    "@/lib/auth": { getSession: async () => ({ user: { id: "session-user" } }) },
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { API: {} } },
    "@/lib/checkout-payment": {
      CheckoutQuoteSchema: sourceLoader().load("lib/checkout-payment.ts").CheckoutQuoteSchema,
      quoteCheckout: async (_items, options) => {
        calls.push(options)
        return options.couponCode ? failure : { ok: true, pricing, amount: 118 }
      },
    },
  })
  const route = loader.load("app/api/cart/validate/route.ts")
  const request = () => new NextRequest("https://fixture.invalid/api/cart/validate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ id: "fixture-product", quantity: 1 }], couponCode: "EXPIRED", userId: "untrusted" }),
  })
  const response = await route.POST(request())
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.couponMessage, "Coupon expired")
  assert.equal(result.amount, 118)
  assert.equal(result.pricing.coupon, null)
  assert.deepEqual(calls.map(options => [options.couponCode, options.userId]), [["EXPIRED", "session-user"], [null, "session-user"]])
  assert.match(response.headers.get("cache-control"), /no-store/)
  calls.length = 0
  failure = { ok: false, error: "Product is unavailable" }
  const refused = await route.POST(request())
  assert.equal(refused.status, 400)
  assert.equal(calls.length, 1, "Stock failures must not retry without a coupon")
})

test("server order pricing identifies a no-longer-valid coupon and preserves current product prices", async () => {
  const loader = sourceLoader({
    "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products", COUPONS: "coupons" }, getCollection: async name => ({
      find: () => ({ toArray: async () => name === "software_products" ? [{ id: "fixture-software", name: "Fixture", price: 236, active: true, trackInventory: false }] : [] }),
      findOne: async () => name === "coupons" ? { code: "EXPIRED", name: "Expired", active: true, type: "fixed", value: 10, endDate: "2000-01-01" } : null,
    }) },
  })
  const { priceOrder } = loader.load("lib/order-pricing.ts")
  const items = [{ id: "fixture-software", quantity: 1, price: 118 }]
  const refused = await priceOrder(items, { userId: null, couponCode: "EXPIRED" })
  assert.equal(refused.ok, false)
  assert.equal(refused.code, "COUPON_UNAVAILABLE")
  const current = await priceOrder(items, { userId: null })
  assert.equal(current.ok, true)
  assert.equal(current.items[0].price, 236)
  assert.equal(current.total, 236)
})

function couponHook(environment, server, method = "delivery") {
  const slots = []
  let cursor = 0
  let pending = []
  let items = [{ id: "fixture-product", quantity: 1 }]
  let owner = "guest"
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        pending.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() } })
      }
    },
  }
  const loader = sourceLoader({
    react,
    "react-hot-toast": { toast: { success() {}, error() {} } },
    "@/lib/checkout-draft": { readCheckoutDraft: () => null },
    "@/lib/api-client": {
      ApiError: server.ApiError,
      apiFetchJson: async (_url, options, parse) => parse(await server.quote(options.json)),
    },
  }, { context: environment.context })
  const useCartCoupon = loader.load("hooks/useCartCoupon.ts").useCartCoupon
  let value
  const CartCouponFixture = () => {
    cursor = 0
    value = useCartCoupon(items, owner, { method })
    const effects = pending; pending = []
    effects.forEach(effect => effect())
    return value
  }
  const settle = async () => {
    for (let i = 0; i < 8; i++) { CartCouponFixture(); await new Promise(resolve => setImmediate(resolve)) }
    return CartCouponFixture()
  }
  return { render: CartCouponFixture, settle, get value() { return value },
    quantity: quantity => { items = [{ ...items[0], quantity }] }, owner: next => { owner = next },
    cleanup: () => slots.forEach(slot => slot?.cleanup?.()) }
}

function server(policy = true) {
  class ApiError extends Error { constructor(status) { super("Coupon no longer eligible"); this.status = status } }
  return { ApiError, policy, fail: false,
    async quote(payload) {
      if (this.fail) throw new this.ApiError(400)
      return { success: true, code: payload.code.toUpperCase(), name: "Fixture coupon", couponRemovable: this.policy, discount: payload.cart[0].quantity * 10 }
    } }
}

test("cart and checkout share removable coupons, removals and refreshed discounts", async () => {
  const environment = browser()
  const api = server()
  const cart = couponHook(environment, api)
  const checkout = couponHook(environment, api, "pickup")
  try {
    await cart.settle(); await checkout.settle()
    cart.value.setCouponCode("fixture")
    cart.render()
    await cart.value.apply()
    await cart.settle(); await checkout.settle()
    assert.equal(cart.value.appliedCoupon.code, "FIXTURE")
    assert.equal(checkout.value.appliedCoupon.code, "FIXTURE")
    assert.equal(checkout.value.appliedCoupon.couponRemovable, true)
    cart.quantity(2)
    cart.render()
    assert.equal(cart.value.applyingCoupon, true)
    await cart.settle()
    assert.equal(cart.value.appliedCoupon.code, "FIXTURE")
    assert.equal(cart.value.couponDiscount, 20)
    checkout.value.remove()
    await checkout.settle(); await cart.settle()
    assert.equal(cart.value.appliedCoupon, null)
    assert.equal(cart.value.couponDiscount, 0)
    assert.equal(environment.entries.get("sara_cart_coupon:guest"), "null")
  } finally { cart.cleanup(); checkout.cleanup() }
})

test("locked coupons cannot be removed on either page or after refresh", async () => {
  const environment = browser()
  const api = server(false)
  const cart = couponHook(environment, api)
  let checkout
  try {
    await cart.settle()
    cart.value.setCouponCode("fixture"); cart.render()
    await cart.value.apply(); await cart.settle()
    cart.value.remove(); await cart.settle()
    assert.equal(cart.value.appliedCoupon.couponRemovable, false)
    checkout = couponHook(environment, api, "pickup")
    await checkout.settle()
    checkout.value.remove(); await checkout.settle()
    assert.equal(checkout.value.appliedCoupon.code, "FIXTURE")
    assert.equal(checkout.value.appliedCoupon.couponRemovable, false)
    // Admin policy changes are read again on the next cart check.
    api.policy = true
    checkout.quantity(2); await checkout.settle()
    assert.equal(checkout.value.appliedCoupon.couponRemovable, true)
    checkout.value.remove(); await checkout.settle(); await cart.settle()
    assert.equal(cart.value.appliedCoupon, null)
  } finally { cart.cleanup(); checkout?.cleanup() }
})

test("an ineligible locked coupon is cleared after the server check", async () => {
  const environment = browser()
  const api = server(false)
  const cart = couponHook(environment, api)
  try {
    await cart.settle()
    cart.value.setCouponCode("fixture"); cart.render()
    await cart.value.apply(); await cart.settle()
    api.fail = true
    cart.quantity(2); await cart.settle()
    assert.equal(cart.value.appliedCoupon, null)
    assert.equal(cart.value.couponDiscount, 0)
  } finally { cart.cleanup() }
})

test("explicit removal does not resurrect an older checkout draft", () => {
  const environment = browser()
  const selection = { code: "FIXTURE", name: "Fixture", couponRemovable: false }
  const persistence = sourceLoader({ "@/lib/checkout-draft": { readCheckoutDraft: () => ({ appliedCoupon: selection }) } },
    { context: environment.context }).load("lib/cart-coupon.ts")
  assert.equal(persistence.readCartCoupon("guest").code, "FIXTURE")
  persistence.saveCartCoupon("guest", null)
  assert.equal(persistence.readCartCoupon("guest"), null)
})

test("the shared cart and checkout coupon controls hide Remove for locked coupons", () => {
  const CartCoupon = sourceLoader().load("components/cart/CartCoupon.tsx").default
  const coupon = { appliedCoupon: { code: "FIXTURE", name: "Fixture", couponRemovable: false }, couponDiscount: 10,
    couponCode: "", applyingCoupon: false, error: "", remove() {}, apply() {}, retry() {}, setCouponCode() {} }
  for (const id of ["cart-coupon", "checkout-coupon"]) {
    const locked = renderToStaticMarkup(CartCoupon({ coupon, id }))
    assert.match(locked, /Cannot be removed/)
    assert.doesNotMatch(locked, />Remove<\/button>/)
    const removable = renderToStaticMarkup(CartCoupon({ coupon: { ...coupon, appliedCoupon: { ...coupon.appliedCoupon, couponRemovable: true } }, id }))
    assert.match(removable, />Remove<\/button>/)
  }
})
