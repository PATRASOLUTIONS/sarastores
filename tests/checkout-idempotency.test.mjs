import assert from "node:assert/strict"
import test from "node:test"
import crypto from "node:crypto"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"

const request = (key, body = { items: [{ id: "fixture", quantity: 1 }] }) => new NextRequest("https://fixture.invalid/api/orders", {
  method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body),
})
function fixture() {
  const rows = new Map()
  const collection = {
    insertOne: async row => {
      if (rows.has(row._id)) throw Object.assign(new Error("Duplicate"), { code: 11000 })
      rows.set(row._id, structuredClone(row))
    },
    findOne: async query => structuredClone(rows.get(query._id) || null),
    updateOne: async (query, update) => { Object.assign(rows.get(query._id), update.$set); return { modifiedCount: 1 } },
  }
  const loader = sourceLoader({ "@/lib/db-service": { getCollection: async name => {
    assert.equal(name, "checkout_requests"); return collection
  } } })
  return { run: loader.load("lib/checkout-idempotency.ts").idempotentCheckout, rows, collection }
}

test("single click creates one checkout and replays the same private response on repeated browser requests", async () => {
  const { run, rows } = fixture()
  const key = crypto.randomUUID()
  let created = 0
  const work = async () => { created++; return Response.json({ orderId: "fixture-order", checkoutToken: "private-capability" }) }
  for (let i = 0; i < 8; i++) {
    const response = await run(request(key), "fixture-user", "order", work)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).orderId, "fixture-order")
    assert.match(response.headers.get("Cache-Control"), /no-store/)
    if (i) assert.equal(response.headers.get("Idempotency-Replayed"), "true")
  }
  assert.equal(created, 1); assert.equal(rows.size, 1)
})

test("double click and simultaneous checkout requests claim one gateway session before calling the provider", async () => {
  const { run } = fixture()
  const key = crypto.randomUUID()
  let release, started
  const blocked = new Promise(resolve => { release = resolve })
  const reached = new Promise(resolve => { started = resolve })
  let created = 0
  const work = async () => { created++; started(); await blocked; return Response.json({ orderId: "only-order" }) }
  const first = run(request(key), null, "razorpay", work)
  await reached
  const duplicates = await Promise.all(Array.from({ length: 12 }, () => run(request(key), null, "razorpay", work)))
  assert.ok(duplicates.every(response => response.status === 409))
  assert.equal(created, 1)
  release(); assert.equal((await first).status, 200)
  assert.equal((await run(request(key), null, "razorpay", work)).status, 200)
  assert.equal(created, 1)
})

test("provider timeout after session creation cannot start a second session on retry", async () => {
  const { run } = fixture()
  let sessions = 0
  const key = crypto.randomUUID()
  const work = async () => { sessions++; return Response.json({ error: "Provider timed out" }, { status: 503 }) }
  assert.equal((await run(request(key), null, "paytm", work)).status, 503)
  assert.equal((await run(request(key), null, "paytm", work)).status, 503)
  assert.equal(sessions, 1)
})

test("crashed or lost provider response remains uncertain and cannot be reclaimed", async () => {
  const { run } = fixture()
  const key = crypto.randomUUID()
  let sessions = 0
  const work = async () => { sessions++; throw new Error("Response lost after provider created session") }
  await assert.rejects(run(request(key), null, "pinelabs", work), /Response lost/)
  const retried = await run(request(key), null, "pinelabs", work)
  assert.equal(retried.status, 409)
  assert.equal((await retried.json()).code, "CHECKOUT_REQUEST_UNCERTAIN")
  assert.equal(sessions, 1)
})

test("changing cart, customer or account during setup cannot reuse the original payment attempt", async () => {
  const { run } = fixture()
  const key = crypto.randomUUID()
  let created = 0
  const work = async () => { created++; return Response.json({ orderId: "original" }) }
  await run(request(key), "owner", "order", work)
  assert.equal((await run(request(key, { items: [{ id: "fixture", quantity: 2 }] }), "owner", "order", work)).status, 409)
  assert.equal((await run(request(key), "other-user", "order", work)).status, 409)
  assert.equal(created, 1)
})

test("missing and malformed request keys are refused before provider invocation", async () => {
  const { run, rows } = fixture()
  for (const key of [null, "abc", "attacker-key"]) {
    assert.equal((await run(request(key), null, "order", () => { throw new Error("Must not run") })).status, 400)
  }
  assert.equal(rows.size, 0)
})

test("safe pre-gateway errors remain retryable and preserve the retry-safe flag on replay", async () => {
  const { run } = fixture()
  const key = crypto.randomUUID()
  let calls = 0
  const work = async () => { calls++; return Response.json({ error: "Total changed" }, { status: 409, headers: { "Checkout-Retry-Safe": "true" } }) }
  for (let i = 0; i < 2; i++) {
    const response = await run(request(key), null, "razorpay", work)
    assert.equal(response.status, 409)
    assert.equal(response.headers.get("Checkout-Retry-Safe"), "true")
  }
  assert.equal(calls, 1)
})

test("refresh after capability expiry does not reopen an old payment session or create a new one", async () => {
  const { run, rows } = fixture()
  const key = crypto.randomUUID()
  let sessions = 0
  const work = async () => { sessions++; return Response.json({ orderId: "old-provider-order" }) }
  await run(request(key), null, "razorpay", work)
  rows.values().next().value.createdAt = new Date(0)
  const expired = await run(request(key), null, "razorpay", work)
  assert.equal(expired.status, 409)
  assert.equal((await expired.json()).code, "CHECKOUT_REQUEST_EXPIRED")
  assert.equal(sessions, 1)
})

test("actual Razorpay create-order API replays one server-priced gateway order and capability", async () => {
  const { collection } = fixture()
  let gatewayCalls = 0, intentCalls = 0
  const loader = sourceLoader({
    "@/lib/auth": { getSession: async () => ({ user: { id: "owner" } }) },
    "@/lib/db-service": { getCollection: async () => collection },
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { ORDERS: {} } },
    "@/lib/checkout-customer": { validateCheckoutCustomer: async customer => ({ ok: true, customer }) },
    "@/lib/checkout-payment": {
      CheckoutQuoteSchema: sourceLoader().load("lib/checkout-payment.ts").CheckoutQuoteSchema,
      quoteCheckout: async () => ({ ok: true, amount: 118, fingerprint: "server-priced-fingerprint" }),
      createCheckoutIntent: async () => { intentCalls++; return "private-capability" },
    },
    "@/lib/razorpay": { createRazorpayOrder: async amount => { gatewayCalls++; assert.equal(amount, 11800); return { id: "fixture-order", amount, currency: "INR" } },
      getRazorpayKeyId: () => "fixture-key", RazorpayOrderError: class extends Error {} },
  })
  const route = loader.load("app/api/payment/create-order/route.ts")
  const key = crypto.randomUUID()
  const body = { items: [{ id: "fixture", quantity: 1, price: 1 }], customer: {}, expectedAmount: 11800 }
  for (let i = 0; i < 3; i++) {
    const response = await route.POST(request(key, body))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).checkoutToken, "private-capability")
  }
  assert.equal(gatewayCalls, 1); assert.equal(intentCalls, 1)
})

function browser(shared = new Map()) {
  const storage = { getItem: key => shared.get(key) || null, setItem: (key, value) => shared.set(key, value), removeItem: key => shared.delete(key) }
  const loader = sourceLoader({}, { context: { window: { localStorage: storage, sessionStorage: storage } } })
  return { ...loader.load("lib/checkout-attempt.ts"), recovery: loader.load("lib/checkout-recovery.ts"), shared }
}

test("refresh and multiple tabs retain one request key and the immutable original cart", async () => {
  const first = browser()
  const body = { items: [{ id: "fixture", quantity: 1 }], customer: { firstName: "Arun" } }
  const attempt = await first.prepareCheckoutAttempt("guest", "razorpay", body, body)
  body.items[0].quantity = 9
  assert.equal(attempt.orderData.items[0].quantity, 1)
  const refreshed = browser(first.shared)
  const saved = await refreshed.prepareCheckoutAttempt("guest", "razorpay", { customer: { firstName: "Arun" }, items: [{ id: "fixture", quantity: 1 }] }, {})
  assert.equal(saved.key, attempt.key)
  const otherTab = browser(first.shared)
  assert.equal((await otherTab.prepareCheckoutAttempt("guest", "razorpay", saved.body, {})).key, attempt.key)
  await assert.rejects(otherTab.prepareCheckoutAttempt("guest", "razorpay", body, body), /earlier payment setup/)
})

test("confirmed failed payment can retry with a new key after recovery clears the previous attempt", async () => {
  const tab = browser()
  const body = { items: [{ id: "fixture", quantity: 1 }] }
  const old = await tab.prepareCheckoutAttempt("owner", "paytm", body, body)
  tab.clearCheckoutAttempt("owner") // Only after authoritative provider failure/completion.
  const fresh = await tab.prepareCheckoutAttempt("owner", "paytm", body, body)
  assert.notEqual(fresh.key, old.key)
})

test("storage unavailable prevents checkout creation instead of losing retry identity", async () => {
  const loader = sourceLoader({}, { context: { window: { localStorage: { getItem: () => null, setItem: () => { throw new Error("Storage denied") } } } } })
  await assert.rejects(loader.load("lib/checkout-attempt.ts").prepareCheckoutAttempt("guest", "paytm", {}, {}), /Storage denied/)
})

test("saved signed payment receipt survives refresh and repeated returns without using the current cart", () => {
  const tab = browser()
  const receipt = { razorpay_order_id: "fixture-order", razorpay_payment_id: "fixture-payment", razorpay_signature: "a".repeat(64), checkoutToken: "t".repeat(43) }
  assert.equal(tab.recovery.saveCheckoutRecovery("owner", { savedAt: Date.now(), receipt, orderData: { items: [{ id: "original", quantity: 1 }] } }), true)
  for (let i = 0; i < 4; i++) {
    const refreshed = browser(tab.shared).recovery.readCheckoutRecovery("owner")
    assert.equal(refreshed.receipt.razorpay_payment_id, "fixture-payment")
    assert.equal(refreshed.orderData.items[0].id, "original")
  }
  assert.equal(tab.recovery.readCheckoutRecovery("another-owner"), null)
})

const element = (tree, type) => {
  if (!tree || typeof tree !== "object") return null
  if (tree.type === type) return tree
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = element(child, type); if (found) return found
  }
  return null
}

for (const provider of ["razorpay", "pinelabs", "paytm"]) {
  test(`${provider}: actual Pay Now handler ignores double/repeated clicks and preserves the cart snapshot during setup`, async () => {
    const tab = browser()
    let release, reached
    const waiting = new Promise(resolve => { release = resolve })
    const started = new Promise(resolve => { reached = resolve })
    const body = { items: [{ id: "original", quantity: 1 }], customer: { firstName: "Arun", lastName: "Kumar", email: "fixture@example.com", phone: "9876543210" } }
    let requests = 0, options, completed
    let stateIndex = 0
    const storage = { getItem: key => tab.shared.get(key) || null, setItem: (key, value) => tab.shared.set(key, value), removeItem: key => tab.shared.delete(key) }
    const loader = sourceLoader({ react: {
      useState: initial => [stateIndex++ === 2 ? true : initial, () => {}],
      useRef: initial => ({ current: initial }), useEffect() {},
    } }, { context: {
      window: { localStorage: storage, sessionStorage: storage, location: { assign() {} }, Razorpay: function(config) { options = config; this.open = () => {} } },
      document: { body: { appendChild() {} }, createElement: () => ({ appendChild() {}, submit() {} }) },
    }, fetch: async (url, init) => {
      if (url === "/api/payment/verify") return Response.json({ paymentId: "fixture-payment", orderId: "fixture-gateway-order" })
      requests++
      assert.match(init.headers["Idempotency-Key"], /^[a-f0-9-]{36}$/)
      const sent = JSON.parse(init.body)
      assert.equal(sent.items[0].quantity, 1)
      reached(); await waiting
      if (provider === "razorpay") return Response.json({ keyId: "fixture-key", orderId: "fixture-gateway-order", amount: 11800, currency: "INR", checkoutToken: "t".repeat(43) })
      return Response.json({ success: true, orderId: "fixture-order", total: 118, tax: 18, shipping: 0,
        checkout: { provider, orderId: "fixture-gateway-order", checkoutToken: "t".repeat(43), redirectUrl: "https://provider.fixture.invalid/checkout" } })
    } })
    const tree = loader.load("components/PaymentGateway.tsx").default({
      provider, checkoutOwner: "owner", paymentMethod: "online", amount: 118, orderDetails: body,
      getHostedOrderData: () => body, beforePayment: async () => true, onCancel() {},
      onSuccess: async (_payment, snapshot) => { completed = snapshot },
    })
    const submit = () => element(tree, "form").props.onSubmit({ preventDefault() {} })
    const first = submit()
    await started
    await Promise.all(Array.from({ length: 10 }, submit))
    body.items[0].quantity = 7
    release(); await first
    assert.equal(requests, 1)
    if (provider === "razorpay") {
      await options.handler({ razorpay_order_id: "fixture-gateway-order", razorpay_payment_id: "fixture-payment", razorpay_signature: "a".repeat(64) })
      assert.equal(completed.items[0].quantity, 1)
    } else {
      assert.equal(loader.load("lib/checkout-recovery.ts").readHostedCheckout().items[0].quantity, 1)
    }
  })
}

test("two simultaneous paid order commits consume one capability and insert one order/payment", async () => {
  const intent = { _id: "fixture-provider-order", userId: "owner", method: "razorpay", status: "verified", paymentId: "fixture-payment", amount: 11800, currency: "INR" }
  let orders = 0, payments = 0, stockChecks = 0
  const transaction = { withTransaction: async work => work(), endSession: async () => {} }
  const loader = sourceLoader({ "@/lib/mongodb": { connectToDatabase: async () => ({ client: { startSession: () => transaction }, db: {
    collection: name => ({
      updateOne: async (query, update) => {
        assert.equal(name, "checkout_intents")
        if (intent.status !== query.status || intent.orderId) return { modifiedCount: 0 }
        Object.assign(intent, update.$set)
        return { modifiedCount: 1 }
      },
      insertOne: async () => { if (name === "orders") orders++; else if (name === "payments") payments++; else throw new Error("Unexpected collection") },
    }),
  } }) } })
  const persist = loader.load("lib/checkout-payment.ts").persistCheckoutOrder
  const original = { ...intent }
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => persist({ orderId: "one-order" }, original, async () => { stockChecks++ })))
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(results.filter(result => result.status === "rejected").length, 9)
  assert.equal(orders, 1); assert.equal(payments, 1); assert.equal(stockChecks, 1)
})
