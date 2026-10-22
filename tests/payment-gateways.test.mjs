import assert from "node:assert/strict"
import test from "node:test"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import PaytmChecksum from "paytmchecksum"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"
import { checkDeploymentEnvironment } from "../scripts/check-deployment-env.mjs"

const key = crypto.randomBytes(8).toString("hex")
const pineKey = crypto.randomBytes(32).toString("hex")
const env = {
  PINELABS_ENABLED: "true", PAYTM_ENABLED: "true",
  PINELABS_ENVIRONMENT: "uat", PINELABS_CLIENT_ID: "fixture-client",
  PINELABS_CLIENT_SECRET: crypto.randomBytes(24).toString("hex"),
  PINELABS_MERCHANT_ID: "fixture-pine-merchant", PINELABS_CALLBACK_SECRET: pineKey,
  PAYTM_ENVIRONMENT: "uat", PAYTM_MERCHANT_ID: "fixture_paytm_mid", PAYTM_MERCHANT_KEY: key,
  NEXT_PUBLIC_SITE_URL: "https://store.fixture.invalid",
}
const request = {
  reference: "SARAECOM-999999", amount: 12345, userId: "fixture-user",
  callbackUrl: `${env.NEXT_PUBLIC_SITE_URL}/api/payment/pinelabs/return`,
  customer: { firstName: "Synthetic", lastName: "Customer", email: "customer@example.invalid", phone: "0000000000" },
}
const pineOrder = {
  order_id: "v1-fixture-order", merchant_order_reference: request.reference,
  merchant_id: env.PINELABS_MERCHANT_ID, status: "PROCESSED",
  order_amount: { value: request.amount, currency: "INR" },
  payments: [{ id: "fixture-payment", status: "PROCESSED", payment_amount: { value: request.amount, currency: "INR" } }],
}
const post = body => new NextRequest(`${env.NEXT_PUBLIC_SITE_URL}/api/payment/status`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})

test("gateway switches preserve Razorpay by default, select enabled providers and reject invalid configuration", () => {
  const loader = sourceLoader()
  const config = loader.load("lib/payment-config.ts")
  assert.equal(config.paymentConfiguration().providers.join(","), "razorpay")
  loader.env.PINELABS_ENABLED = "true"
  loader.env.PAYTM_ENABLED = "true"
  loader.env.PAYMENT_DEFAULT_PROVIDER = "paytm"
  assert.equal(config.paymentConfiguration().providers.join(","), "pinelabs,razorpay,paytm")
  assert.equal(config.paymentConfiguration().defaultProvider, "paytm")
  loader.env.PAYTM_ENABLED = "false"
  assert.throws(() => config.paymentConfiguration(), /enabled gateway/)
  delete loader.env.PAYMENT_DEFAULT_PROVIDER
  loader.env.RAZORPAY_ENABLED = "false"
  loader.env.PINELABS_ENABLED = "false"
  assert.equal(config.paymentConfiguration().providers.length, 0)
  assert.equal(config.paymentConfiguration().defaultProvider, null)
  loader.env.PINELABS_ENABLED = "yes"
  assert.throws(() => config.paymentConfiguration(), /true or false/)
})

test("configuration endpoint returns only non-secret gateway choices", async () => {
  const loader = sourceLoader({}, { env })
  const response = await loader.load("app/api/payment/config/route.ts").GET()
  const data = await response.json()
  assert.deepEqual(data, { providers: ["pinelabs", "razorpay", "paytm"], defaultProvider: "pinelabs", codEnabled: true, instoreEnabled: false })
  assert.match(response.headers.get("cache-control"), /no-store/)
  for (const value of [key, pineKey, env.PINELABS_CLIENT_SECRET]) assert.equal(JSON.stringify(data).includes(value), false)
})

for (let mask = 0; mask < 8; mask++) {
  test(`gateway flags expose exactly the enabled providers and prefer Pine Labs (combination ${mask})`, () => {
    const order = ["pinelabs", "razorpay", "paytm"]
    const switches = Object.fromEntries(order.map((provider, index) => [
      `${provider.toUpperCase()}_ENABLED`, mask & (1 << index) ? "true" : "false",
    ]))
    const config = sourceLoader({}, { env: switches }).load("lib/payment-config.ts").paymentConfiguration()
    const expected = order.filter((_, index) => mask & (1 << index))
    assert.deepEqual(Array.from(config.providers), expected)
    assert.equal(config.defaultProvider, expected[0] ?? null)
  })
}

test("disabled Razorpay refuses new checkout without calling the provider", async () => {
  let calls = 0
  const loader = sourceLoader({
    "@/lib/razorpay": { getRazorpayClient: () => { calls++; throw new Error("Should not create payment") } },
  }, { env: { RAZORPAY_ENABLED: "false" } })
  assert.equal((await loader.load("app/api/payment/create-order/route.ts").POST(post({ items: [] }))).status, 503)
  assert.equal(calls, 0)
})

for (const environment of ["uat", "production"]) {
  test(`Pine ${environment} initiation uses OAuth, exact paise and a fixed signed return endpoint`, async () => {
    const calls = []
    const loader = sourceLoader({}, {
      env: { ...env, PINELABS_ENVIRONMENT: environment },
      fetch: async (url, options) => {
        calls.push({ url, options })
        return Response.json(url.endsWith("/token")
          ? { access_token: "fixture-access", expires_in: 3600 }
          : { response_code: 200, order_id: pineOrder.order_id,
            redirect_url: "https://api.pluralonline.com/api/v3/checkout-bff/redirect/checkout?token=fixture" })
      },
    })
    const result = await loader.load("lib/hosted-payment-providers.ts").createHostedProviderOrder("pinelabs", request)
    assert.equal(result.orderId, pineOrder.order_id)
    assert.equal(calls.length, 2)
    assert.ok(calls[0].url.startsWith(environment === "uat" ? "https://pluraluat.v2.pinepg.in/" : "https://api.pluralpay.in/"))
    const tokenBody = JSON.parse(calls[0].options.body)
    assert.equal(tokenBody.grant_type, "client_credentials")
    assert.equal(tokenBody.client_secret, env.PINELABS_CLIENT_SECRET)
    const body = JSON.parse(calls[1].options.body)
    assert.deepEqual(body.order_amount, { value: 12345, currency: "INR" })
    assert.equal(body.merchant_order_reference, request.reference)
    assert.equal(body.callback_url, request.callbackUrl)
    assert.equal(body.failure_callback_url, request.callbackUrl)
    assert.equal(body.pre_auth, false)
    assert.equal(calls[1].options.headers.Authorization, "Bearer fixture-access")
    assert.ok(calls[1].options.headers["Request-ID"])
  })
}

test("Pine rejects unexpected redirect hosts, missing signing key and provider HTTP errors", async () => {
  for (const redirect of ["https://evil.invalid/checkout", "http://api.pluralonline.com/checkout", "https://evil@api.pluralonline.com/checkout"]) {
    const loader = sourceLoader({}, { env, fetch: async url => Response.json(url.endsWith("/token")
      ? { access_token: "fixture", expires_in: 3600 }
      : { response_code: 200, order_id: "fixture", redirect_url: redirect }) })
    await assert.rejects(loader.load("lib/hosted-payment-providers.ts").createHostedProviderOrder("pinelabs", request), /unexpected checkout URL/)
  }
  const missing = sourceLoader({}, { env: { ...env, PINELABS_CALLBACK_SECRET: "" } })
  await assert.rejects(missing.load("lib/hosted-payment-providers.ts").createHostedProviderOrder("pinelabs", request), /required/)
  for (const status of [404, 504]) {
    const failing = sourceLoader({}, { env, fetch: async () => new Response(null, { status }) })
    await assert.rejects(failing.load("lib/hosted-payment-providers.ts").createHostedProviderOrder("pinelabs", request), new RegExp(`${status}`))
  }
})

test("Pine verifies sorted callback fields with the separate hexadecimal signing key", () => {
  const provider = sourceLoader({}, { env }).load("lib/hosted-payment-providers.ts")
  for (const fields of [
    { order_id: pineOrder.order_id, status: "PROCESSED" },
    { error_message: "Consumer Authentication required", status: "FAILED", order_id: pineOrder.order_id, error_code: "USER_AUTHENTICATION_FAILED" },
  ]) {
    const payload = Object.keys(fields).sort().map(name => `${name}=${fields[name]}`).join("&")
    const signature = crypto.createHmac("sha256", Buffer.from(pineKey, "hex")).update(payload).digest("hex").toUpperCase()
    assert.equal(provider.verifyPineCallback({ ...fields, signature }), true)
    assert.equal(provider.verifyPineCallback({ ...fields, status: "AUTHORIZED", signature }), false)
    assert.equal(provider.verifyPineCallback({ ...fields, signature: "bad" }), false)
  }
})

for (const [label, change, expectedStatus] of [
  ["captured exact checkout", {}, "completed"],
  ["authorized only", { status: "AUTHORIZED" }, "pending"],
  ["pending", { status: "PENDING" }, "pending"],
  ["failed", { status: "FAILED" }, "failed"],
  ["wrong merchant", { merchant_id: "wrong-merchant" }, null],
  ["wrong reference", { merchant_order_reference: "wrong-order" }, null],
  ["wrong order", { order_id: "wrong-id" }, null],
  ["one paisa short", { order_amount: { value: 12344, currency: "INR" } }, null],
  ["wrong currency", { order_amount: { value: 12345, currency: "USD" } }, null],
  ["uncaptured payment", { payments: [{ ...pineOrder.payments[0], status: "AUTHORIZED" }] }, null],
  ["wrong captured amount", { payments: [{ ...pineOrder.payments[0], payment_amount: { value: 12344, currency: "INR" } }] }, null],
  ["ambiguous multiple payments", { payments: [pineOrder.payments[0], pineOrder.payments[0]] }, null],
]) {
  test(`Pine order lookup handles ${label} without trusting browser or webhook claims`, async () => {
    const loader = sourceLoader({}, { env, fetch: async url => Response.json(url.endsWith("/token")
      ? { access_token: "fixture", expires_in: 3600 } : { data: { ...pineOrder, ...change } }) })
    const verification = loader.load("lib/hosted-payment-providers.ts").verifyHostedProviderPayment("pinelabs", {
      orderId: pineOrder.order_id, reference: request.reference, amount: request.amount,
    })
    if (expectedStatus) assert.equal((await verification).status, expectedStatus)
    else await assert.rejects(verification, /match|reconciliation/)
  })
}

test("Paytm initiation signs the server amount and returns only hosted form fields", async () => {
  let sent
  const loader = sourceLoader({}, { env, fetch: async (url, options) => {
    assert.ok(url.startsWith("https://securestage.paytmpayments.com/theia/api/v1/initiateTransaction?"))
    sent = JSON.parse(options.body)
    assert.equal(PaytmChecksum.verifySignature(JSON.stringify(sent.body), key, sent.head.signature), true)
    const body = { resultInfo: { resultStatus: "S" }, txnToken: "synthetic-token" }
    return Response.json({ body, head: { signature: await PaytmChecksum.generateSignature(JSON.stringify(body), key) } })
  } })
  const result = await loader.load("lib/hosted-payment-providers.ts").createHostedProviderOrder("paytm", request)
  assert.deepEqual(sent.body.txnAmount, { value: "123.45", currency: "INR" })
  assert.equal(sent.body.websiteName, "WEBSTAGING")
  assert.equal(sent.body.userInfo.custId, request.userId)
  assert.deepEqual({ ...result.formFields }, { mid: env.PAYTM_MERCHANT_ID, orderId: request.reference, txnToken: "synthetic-token" })
  assert.ok(result.redirectUrl.includes("/showPaymentPage?"))
})

for (const [label, change, status] of [
  ["successful exact checkout", {}, "completed"],
  ["pending", { resultInfo: { resultStatus: "PENDING" } }, "pending"],
  ["failed", { resultInfo: { resultStatus: "TXN_FAILURE" } }, "failed"],
  ["no record yet", { resultInfo: { resultStatus: "NO_RECORD_FOUND" }, mid: undefined, orderId: undefined }, "pending"],
  ["wrong MID", { mid: "wrong-mid" }, null],
  ["wrong order", { orderId: "wrong-order" }, null],
  ["one paisa short", { txnAmount: "123.44" }, null],
  ["invalid decimal precision", { txnAmount: "123.450" }, null],
  ["missing transaction id", { txnId: undefined }, null],
]) {
  test(`Paytm signed status lookup handles ${label}`, async () => {
    const loader = sourceLoader({}, { env, fetch: async (url, options) => {
      assert.equal(url, "https://securestage.paytmpayments.com/v3/order/status")
      const sent = JSON.parse(options.body)
      assert.equal(PaytmChecksum.verifySignature(JSON.stringify(sent.body), key, sent.head.signature), true)
      const body = { resultInfo: { resultStatus: "TXN_SUCCESS" }, mid: env.PAYTM_MERCHANT_ID,
        orderId: request.reference, txnAmount: "123.45", txnId: "fixture-paytm-payment", ...change }
      // JSON serialization omits undefined fields, as a real provider response does.
      const parsedBody = JSON.parse(JSON.stringify(body))
      return Response.json({ body: parsedBody, head: { signature: await PaytmChecksum.generateSignature(JSON.stringify(parsedBody), key) } })
    } })
    const result = loader.load("lib/hosted-payment-providers.ts").verifyHostedProviderPayment("paytm", {
      orderId: request.reference, reference: request.reference, amount: request.amount,
    })
    if (status) assert.equal((await result).status, status)
    else await assert.rejects(result, /match/)
  })
}

test("Paytm rejects forged response signatures and verifies callback checksums", async () => {
  const body = { MID: env.PAYTM_MERCHANT_ID, ORDERID: request.reference, STATUS: "TXN_SUCCESS", TXNAMOUNT: "123.45" }
  const checksum = await PaytmChecksum.generateSignature(body, key)
  const loader = sourceLoader({}, { env, fetch: async () => Response.json({
    body: { resultInfo: { resultStatus: "TXN_SUCCESS" } }, head: { signature: checksum },
  }) })
  const provider = loader.load("lib/hosted-payment-providers.ts")
  assert.equal(provider.verifyPaytmCallback({ ...body, CHECKSUMHASH: checksum }), true)
  assert.equal(provider.verifyPaytmCallback({ ...body, TXNAMOUNT: "1.00", CHECKSUMHASH: checksum }), false)
  assert.equal(provider.verifyPaytmCallback({ ...body, CHECKSUMHASH: "malformed" }), false)
  await assert.rejects(provider.verifyHostedProviderPayment("paytm", {
    orderId: request.reference, reference: request.reference, amount: request.amount,
  }), /signature verification failed/)
})

function reconciliationFixture({ status = "completed", couponFailure = false, amountMismatch = false, provider = "pinelabs", software = false } = {}) {
  const token = crypto.randomBytes(32).toString("base64url")
  let state = {
    intent: {
      _id: pineOrder.order_id, userId: "fixture-user", tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      amount: request.amount, currency: "INR", method: provider, status: "created",
      merchantReference: request.reference, orderId: request.reference, expiresAt: new Date(0),
    },
    order: {
      _id: "fixture-native-id", orderId: request.reference, userId: "fixture-user", status: "pending",
      total: amountMismatch ? 1 : 123.45, subtotal: 100, tax: 18, shipping: 5.45, paymentMethod: provider,
      items: [{ id: "fixture-product", name: "Synthetic", quantity: 1, price: 118, type: software ? "software" : "hardware" }],
      customer: request.customer, coupon: { code: "FIXTURE", name: "Synthetic", discount: 1 },
      loyalty: { pointsRedeemed: 100, discount: 1 },
      paymentDetails: { method: provider, status: "pending", orderId: pineOrder.order_id },
      timeline: [],
    },
    payments: [],
  }
  let providerCalls = 0
  let couponCalls = 0
  let rewardsCalls = 0
  const effects = []
  const notifications = []
  const read = (doc, path) => path.split(".").reduce((value, name) => value?.[name], doc)
  const matches = (doc, filter) => Object.entries(filter).every(([name, expected]) => {
    const value = read(doc, name)
    if (expected && typeof expected === "object") {
      if ("$ne" in expected) return value !== expected.$ne
      if ("$exists" in expected) return (value !== undefined) === expected.$exists
    }
    return value === expected
  })
  const collection = name => ({
    findOne: async filter => {
      const doc = name === "checkout_intents" ? state.intent : state.order
      return matches(doc, filter) ? { ...doc, paymentDetails: doc.paymentDetails && { ...doc.paymentDetails } } : null
    },
    updateOne: async (filter, update) => {
      const doc = name === "checkout_intents" ? state.intent : state.order
      if (!matches(doc, filter)) return { modifiedCount: 0, matchedCount: 0 }
      for (const [path, value] of Object.entries(update.$set || {})) {
        const parts = path.split(".")
        const target = parts.slice(0, -1).reduce((value, name) => value[name], doc)
        target[parts.at(-1)] = value
      }
      if (update.$push?.timeline) doc.timeline.push(update.$push.timeline)
      return { modifiedCount: 1, matchedCount: 1 }
    },
    insertOne: async doc => { assert.equal(name, "payments"); state.payments.push(doc) },
  })
  const transaction = {
    withTransaction: async work => {
      const before = structuredClone(state)
      try { await work() } catch (error) { state = before; throw error }
    },
    endSession: async () => {},
  }
  const loader = sourceLoader({
    "next/server": { after: work => effects.push(work) },
    "@/lib/db-service": { getCollection: async name => collection(name), normalizeId: doc => ({ ...doc, id: doc._id }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client: { startSession: () => transaction }, db: { collection } }) },
    "@/lib/hosted-payment-providers": {
      verifyHostedProviderPayment: async (_provider, expected) => {
        providerCalls++
        assert.equal(expected.amount, request.amount)
        assert.equal(expected.reference, request.reference)
        return status === "completed" ? { status, paymentId: "fixture-payment" } : { status }
      },
    },
    "@/lib/order-pricing": { consumeOrderCoupon: async (_items, _coupon, identity, session) => {
      assert.equal(identity, "fixture-user"); assert.equal(session, transaction); couponCalls++
      return couponFailure ? { ok: false, error: "Coupon changed" } : { ok: true }
    } },
    "@/lib/loyalty": { redeemPoints: async options => {
      rewardsCalls++; assert.equal(options.session, transaction); return { ok: true }
    } },
    "@/lib/order-notifications": { notifyAdminOrder: async id => {
      notifications.push({ id, status: state.order.status })
      return { status: "sent" }
    } },
    "@/lib/email": { sendEmail: async () => ({ success: true }), getVendorOrderNotificationTemplate: () => "<p>Synthetic confirmation</p>" },
    "@/lib/software-fulfillment": { fulfillSoftwareOrder: async () => {
      if (!software) throw new Error("Unexpected fulfillment")
      state.order.status = "delivered"
    } },
    "@/lib/external-fulfillment": { queueExternalOrder: async () => { throw new Error("Unexpected fulfillment") }, fulfillExternalOrder: async () => {} },
  }, { env: { ...env, PINELABS_ENABLED: "false", PAYTM_ENABLED: "false" }, context: { console: { ...console, error() {} } } })
  return { loader, token, state: () => state, effects, notifications, counts: () => ({ providerCalls, couponCalls, rewardsCalls }),
    reconcile: () => loader.load("lib/hosted-checkout.ts").reconcileHostedCheckout({ ...state.intent }) }
}

for (const provider of ["pinelabs", "paytm"]) {
  test(`${provider} dispatches confirmed notifications once even when software fulfillment has delivered the order`, async () => {
    const fixture = reconciliationFixture({ provider, software: true })
    assert.equal(await fixture.reconcile(), "completed")
    await fixture.effects[0]()
    assert.deepEqual(fixture.notifications, [{ id: "fixture-native-id", status: "delivered" }])
    assert.equal(fixture.state().order.status, "delivered")
    assert.equal(await fixture.reconcile(), "completed")
    assert.equal(fixture.effects.length, 1)
    assert.equal(fixture.notifications.length, 1)
  })
}

for (const provider of ["pinelabs", "paytm"]) {
  test(`${provider} confirmation atomically consumes discounts/payment once, even after expiry or disabling new payments`, async () => {
    const fixture = reconciliationFixture({ provider })
    assert.equal(await fixture.reconcile(), "completed")
    assert.equal(fixture.state().intent.status, "consumed")
    assert.equal(fixture.state().order.status, "confirmed")
    assert.equal(fixture.state().order.paymentDetails.status, "completed")
    assert.equal(fixture.state().payments.length, 1)
    assert.equal(fixture.state().payments[0].method, provider)
    assert.equal(fixture.state().payments[0].amount, 123.45)
    assert.equal(fixture.effects.length, 1)
    assert.equal(await fixture.reconcile(), "completed")
    assert.deepEqual(fixture.counts(), { providerCalls: 1, couponCalls: 1, rewardsCalls: 1 })
    assert.equal(fixture.effects.length, 1)
  })
}

test("concurrent hosted confirmations produce one payment and one fulfillment dispatch", async () => {
  const fixture = reconciliationFixture()
  assert.deepEqual(await Promise.all([fixture.reconcile(), fixture.reconcile()]), ["completed", "completed"])
  assert.equal(fixture.state().payments.length, 1)
  assert.equal(fixture.effects.length, 1)
  assert.equal(fixture.counts().couponCalls, 1)
})

for (const status of ["pending", "failed"]) {
  test(`hosted ${status} cannot consume discounts or trigger paid fulfillment`, async () => {
    const fixture = reconciliationFixture({ status })
    assert.equal(await fixture.reconcile(), status)
    assert.equal(fixture.state().payments.length, 0)
    assert.equal(fixture.state().order.status, "pending")
    assert.equal(fixture.state().order.paymentDetails.status, status)
    assert.equal(fixture.effects.length, 0)
    assert.equal(fixture.counts().couponCalls, 0)
    assert.equal(fixture.counts().rewardsCalls, 0)
  })
}

test("post-payment discount conflict persists a review record rather than losing a captured payment", async () => {
  const fixture = reconciliationFixture({ couponFailure: true })
  assert.equal(await fixture.reconcile(), "review")
  assert.equal(fixture.state().payments.length, 1)
  assert.equal(fixture.state().order.status, "payment_review")
  assert.equal(fixture.state().order.paymentDetails.status, "completed")
  assert.equal(fixture.counts().rewardsCalls, 0)
  assert.equal(fixture.effects.length, 0)
  assert.equal(await fixture.reconcile(), "review")
})

test("stored-order mismatch rolls back the intent claim and refuses payment acceptance", async () => {
  const fixture = reconciliationFixture({ amountMismatch: true })
  await assert.rejects(fixture.reconcile(), /does not match/)
  assert.equal(fixture.state().intent.status, "created")
  assert.equal(fixture.state().payments.length, 0)
  assert.equal(fixture.effects.length, 0)
})

test("hosted status endpoint binds account identity and checkout capability; guests can recover without a cookie", async () => {
  let session = { user: { id: "other-user" } }
  let reconciliations = 0
  const token = crypto.randomBytes(32).toString("base64url")
  const intent = { _id: "fixture-id", method: "pinelabs", userId: "fixture-user", orderId: request.reference,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex") }
  const loader = sourceLoader({
    "@/lib/auth": { getSession: async () => session },
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { API: {} } },
    "@/lib/db-service": { getCollection: async () => ({ findOne: async filter => filter.tokenHash === intent.tokenHash ? intent : null }) },
    "@/lib/hosted-checkout": { reconcileHostedCheckout: async () => { reconciliations++; return "completed" } },
  })
  const route = loader.load("app/api/payment/status/route.ts")
  assert.equal((await route.POST(post({ orderId: "fixture-id", checkoutToken: token }))).status, 404)
  session = { user: { id: "fixture-user" } }
  assert.equal((await route.POST(post({ orderId: "fixture-id", checkoutToken: "x".repeat(43) }))).status, 404)
  assert.equal(reconciliations, 0)
  assert.equal((await route.POST(post({ orderId: "fixture-id", checkoutToken: token }))).status, 200)
  intent.userId = null
  session = null
  assert.equal((await route.POST(post({ orderId: "fixture-id", checkoutToken: token }))).status, 200)
  assert.equal(reconciliations, 2)
})

test("production preflight checks only enabled gateways and rejects missing or UAT hosted credentials without exposing values", () => {
  const errors = checkDeploymentEnvironment({
    ...env, RAZORPAY_ENABLED: "false", PAYMENT_DEFAULT_PROVIDER: "pinelabs",
  })
  assert.equal(errors.some(error => error.startsWith("RAZORPAY_KEY_")), false)
  assert.ok(errors.some(error => error.startsWith("PINELABS_ENVIRONMENT")))
  assert.ok(errors.some(error => error.startsWith("PAYTM_ENVIRONMENT")))
  for (const secret of [key, pineKey, env.PINELABS_CLIENT_SECRET]) assert.equal(errors.join("\n").includes(secret), false)
  const liveErrors = checkDeploymentEnvironment({
    ...env, RAZORPAY_ENABLED: "false", PINELABS_ENVIRONMENT: "production", PAYTM_ENVIRONMENT: "production",
  })
  assert.equal(liveErrors.some(error => /^PINELABS|^PAYTM/.test(error)), false)
})

test("production template includes explicit gateway flags and placeholder live credentials", () => {
  const template = fs.readFileSync(path.resolve(".env.production.example"), "utf8")
  for (const setting of [
    "RAZORPAY_ENABLED=true", "PINELABS_ENABLED=true", "PAYTM_ENABLED=false",
    "PAYMENT_DEFAULT_PROVIDER=pinelabs", "PINELABS_ENVIRONMENT=production", "PAYTM_ENVIRONMENT=production",
  ]) {
    assert.ok(template.split(/\r?\n/).includes(setting), `Missing production setting: ${setting}`)
  }
  for (const key of ["PINELABS_MERCHANT_ID", "PINELABS_CLIENT_ID", "PINELABS_CLIENT_SECRET", "PINELABS_CALLBACK_SECRET"]) {
    assert.match(template, new RegExp(`^${key}="<[^>]+>"$`, "m"))
  }
  assert.match(template, /^PAYTM_MERCHANT_ID=$/m)
  assert.match(template, /^PAYTM_MERCHANT_KEY=$/m)
})

for (const provider of ["pinelabs", "paytm"]) {
  test(`${provider} order initiation persists a server-priced pending order before redirect without consuming rewards or fulfilling`, async () => {
    let persisted
    let initialized = false
    const token = crypto.randomBytes(32).toString("base64url")
    const loader = sourceLoader({
      "@/lib/auth": { getSession: async () => null },
      "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { ORDERS: {} } },
      "@/lib/order-id": { generateOrderId: async () => request.reference },
      "@/lib/order-pricing": {
        priceOrder: async () => ({
          ok: true, items: [{ id: "fixture", quantity: 1, price: 123.45, name: "Synthetic", type: "hardware" }],
          subtotal: 100, tax: 18, shipping: 5.45, total: 123.45,
          coupon: { code: "FIXTURE", name: "Synthetic", discount: 1 },
        }),
        consumeOrderCoupon: async () => { throw new Error("Must not redeem before payment") },
      },
      "@/lib/loyalty": { quoteRedemption: async () => { throw new Error("Guest cannot redeem") },
        redeemPoints: async () => { throw new Error("Must not redeem before payment") } },
      "@/lib/checkout-payment": {
        checkoutFingerprint: () => "fixture-fingerprint",
        getCheckoutIntent: async () => ({ _id: "fixture-provider-order", method: provider, userId: null, status: "created" }),
        persistCheckoutOrder: async (order, intent, callback) => {
          assert.equal(initialized, true)
          assert.equal(intent.method, provider)
          await callback({})
          persisted = order
          return "fixture-native-id"
        },
        CheckoutConflictError: class extends Error {},
      },
      "@/lib/hosted-checkout": { notifyHostedGuestOrder: () => {}, initiateHostedCheckout: async (method, reference, userId, quote) => {
        initialized = true
        assert.equal(method, provider)
        assert.equal(reference, request.reference)
        assert.equal(userId, null)
        assert.equal(quote.amount, 123.45)
        return { provider, orderId: "fixture-provider-order", checkoutToken: token, redirectUrl: "https://provider.fixture.invalid/checkout" }
      } },
      "@/lib/db-service": { getCollection: async () => { throw new Error("No cart clearing before payment") } },
    })
    const response = await loader.load("app/api/orders/route.ts").POST(post({
      items: [{ id: "fixture", quantity: 1, price: 1 }], customer: request.customer,
      paymentMethod: provider, total: 1, status: "confirmed", userId: "forged-user",
      paymentDetails: { status: "completed", paymentId: "forged-payment" },
    }))
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.checkout.checkoutToken, token)
    assert.equal(typeof data.guestAccessToken, "string")
    assert.equal(data.orderId, request.reference)
    assert.equal(persisted.total, 123.45)
    assert.equal(persisted.status, "pending")
    assert.equal(persisted.paymentDetails.orderId, "fixture-provider-order")
    assert.equal(persisted.paymentDetails.status, "pending")
    assert.equal(persisted.paymentVerification.verified, false)
    assert.equal(persisted.userId, null)
    assert.equal(JSON.stringify(data).includes("guestAccessTokenHash"), false)
  })
}

test("hosted pending persistence binds the intent to exactly one order without prematurely consuming it", async () => {
  let binding
  let inserted = 0
  let paymentWrites = 0
  const transaction = {
    withTransaction: async work => work(), endSession: async () => {},
  }
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({
      client: { startSession: () => transaction },
      db: { collection: name => ({
        updateOne: async (query, update, options) => {
          assert.equal(name, "checkout_intents")
          assert.equal(query.status, "created")
          assert.equal(query.orderId.$exists, false)
          assert.equal(options.session, transaction)
          if (binding) return { modifiedCount: 0 }
          binding = update.$set
          return { modifiedCount: 1 }
        },
        insertOne: async () => { if (name === "payments") paymentWrites++; else inserted++ },
      }) },
    }) },
  })
  const persist = loader.load("lib/checkout-payment.ts").persistCheckoutOrder
  const intent = { _id: "fixture-provider-order", method: "pinelabs" }
  await persist({ orderId: request.reference }, intent)
  assert.equal(binding.status, "created")
  assert.equal(binding.orderId, request.reference)
  assert.equal(inserted, 1)
  assert.equal(paymentWrites, 0)
  await assert.rejects(persist({ orderId: "different-order" }, intent), /already been used/)
  assert.equal(inserted, 1)
})

test("signed Pine return uses the configured origin and never trusts returned success without server reconciliation", async () => {
  const fields = { order_id: pineOrder.order_id, status: "PROCESSED" }
  const signature = crypto.createHmac("sha256", Buffer.from(pineKey, "hex"))
    .update(`order_id=${fields.order_id}&status=${fields.status}`).digest("hex")
  let reconciled = 0
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => ({ findOne: async filter =>
      filter._id === pineOrder.order_id && filter.method === "pinelabs" ? { _id: pineOrder.order_id } : null }) },
    "@/lib/hosted-checkout": { reconcileHostedCheckout: async () => { reconciled++; return "pending" } },
  }, { env })
  const route = loader.load("app/api/payment/[provider]/return/route.ts")
  const context = { params: Promise.resolve({ provider: "pinelabs" }) }
  const url = `https://attacker-origin.invalid/return?${new URLSearchParams({ ...fields, signature })}`
  const response = await route.GET(new Request(url), context)
  assert.equal(response.status, 303)
  assert.equal(response.headers.get("location"), `${env.NEXT_PUBLIC_SITE_URL}/checkout?paymentReturn=${pineOrder.order_id}`)
  assert.equal(reconciled, 1)
  const bad = await route.GET(new Request(url.replace(signature, "0".repeat(64))), context)
  assert.equal(bad.status, 400)
  assert.equal(reconciled, 1)
})

test("Pine webhook success claims cannot confirm a payment whose authenticated provider lookup remains pending", async () => {
  const fixture = reconciliationFixture({ status: "pending" })
  const loader = sourceLoader({
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { API: {} } },
    "@/lib/db-service": { getCollection: async () => ({ findOne: async filter =>
      filter._id === pineOrder.order_id ? fixture.state().intent : null }) },
    "@/lib/hosted-checkout": fixture.loader.load("lib/hosted-checkout.ts"),
  })
  const route = loader.load("app/api/payment/[provider]/webhook/route.ts")
  const result = await route.POST(post({
    event_type: "ORDER_PROCESSED", data: { order_id: pineOrder.order_id, status: "PROCESSED",
      order_amount: { value: 1, currency: "INR" }, payments: [{ id: "forged" }] },
  }), { params: Promise.resolve({ provider: "pinelabs" }) })
  assert.equal(result.status, 200)
  assert.equal((await result.json()).status, "pending")
  assert.equal(fixture.counts().providerCalls, 1)
  assert.equal(fixture.state().payments.length, 0)
  assert.equal(fixture.effects.length, 0)
})

function findElement(element, type) {
  if (!element || typeof element !== "object") return null
  if (element.type === type) return element
  const children = [element.props?.children].flat(Infinity)
  for (const child of children) {
    const found = findElement(child, type)
    if (found) return found
  }
  return null
}

function elements(element) {
  if (!element || typeof element !== "object") return []
  if (Array.isArray(element)) return element.flatMap(elements)
  return [element, ...elements(element.props?.children)]
}

test("checkout logo cards show only enabled gateways and keep offline choices independently selectable", () => {
  const options = sourceLoader({ "next/image": "provider-image" }).load("components/CheckoutPaymentOptions.tsx")
  const selected = []
  for (const codEnabled of [true, false]) {
   for (const instoreEnabled of [true, false]) {
   for (const providers of [[], ["pinelabs"], ["razorpay", "paytm"], ["pinelabs", "razorpay", "paytm"]]) {
     const choices = [...providers, ...(codEnabled ? ["cash-on-delivery"] : []), ...(instoreEnabled ? ["instore"] : [])]
     for (const choice of [null, ...choices]) {
       const tree = options.default({ providers, codEnabled, instoreEnabled, selected: choice, onChange: value => selected.push(value) })
       const radios = elements(tree).filter(node => node.type === "input")
       assert.deepEqual(radios.map(node => node.props.value), choices)
       assert.equal(radios.filter(node => node.props.checked).length, choice === null ? 0 : 1)
       for (const radio of radios) {
         assert.equal(radio.props.checked, radio.props.value === choice)
         radio.props.onChange()
         assert.equal(selected.at(-1), radio.props.value)
       }
     }
   }
   }
  }
  for (const provider of ["pinelabs", "razorpay", "paytm"]) {
    const logo = options.PaymentProviderLogo({ provider })
    assert.equal(logo.props.src, `/payment-gateways/${provider}.svg`)
    assert.ok(logo.props.alt)
    assert.ok(logo.props.width > 0 && logo.props.height > 0)
    const asset = fs.readFileSync(path.resolve("public", "payment-gateways", `${provider}.svg`), "utf8")
    assert.match(asset, /^<svg\b/)
    assert.doesNotMatch(asset, /<(?:script|foreignObject|image)\b/i)
  }
})

function checkoutOptionsFixture(config, fail = false, deliveryMode = "blocked") {
  const states = []
  const effects = []
  const errors = []
  let index = 0
  let mounted = false
  const slot = initial => {
    const current = index++
    if (!(current in states)) states[current] = initial
    return current
  }
  const loader = sourceLoader({
    react: {
      useState: initial => {
        const current = slot(initial)
        return [states[current], value => { states[current] = typeof value === "function" ? value(states[current]) : value }]
      },
      useRef: initial => states[slot({ current: initial })],
      useEffect: effect => { if (!mounted) effects.push(effect) },
    },
    "./checkout.module.css": {},
    "next/link": "link",
    "next/navigation": { useRouter: () => ({ push() {}, replace() {} }) },
    "@/components/Header": "header",
    "@/components/Footer": "footer",
    "@/components/PaymentGateway": "payment-gateway",
    "@/components/CheckoutPaymentOptions": { default: "checkout-options", PaymentProviderLogo: "provider-logo", __esModule: true },
    "@/components/InStorePurchase": "in-store",
    "@/components/FulfilmentSelector": "fulfilment",
    "@/components/LoyaltyRedeemer": "loyalty",
    "@/components/CartProductImage": "product-image",
    "@/components/OrderSuccess": "order-success",
    "@/hooks/useCart": { useCart: () => ({
      cart: [{ id: "fixture-product", type: "software", name: "Synthetic Product", price: 118, quantity: 1 }],
      clearCart() {}, removeFromCart() {}, refreshItemPrices() {}, isLoading: false,
    }) },
    "@/contexts/AuthContext": { useAuth: () => ({ user: null, isLoading: false }) },
    "@/hooks/useSettingsData": { useSettingsData: () => ({ data: { shippingFee: 99, freeShippingThreshold: 1000 }, isLoading: false }) },
    "@/hooks/useSubmitLock": { useSubmitLock: () => ({ acquire: () => true, release() {} }) },
    "@/lib/analytics": { analytics: { beginCheckout() {} }, toAnalyticsItem: item => item },
    "react-hot-toast": { toast: { error: message => errors.push(message) } },
  }, {
    fetch: async url => {
      if (url === "/api/blocked-pincodes") return Response.json({ mode: deliveryMode, blockedPincodes: ["400001"], allowedPincodes: [] })
      assert.equal(url, "/api/payment/config")
      return fail ? Response.json({ error: "Configuration unavailable" }, { status: 503 }) : Response.json(config)
    },
    context: {
      sessionStorage: { getItem: () => null },
      window: { location: { search: "" } },
      console: { ...console, error: (...args) => errors.push(args) },
    },
  })
  const page = loader.load("app/checkout/page.tsx")
  const render = () => { index = 0; return page.default() }
  render()
  mounted = true
  for (const effect of effects) effect()
  return { render, errors }
}

for (const mode of ["all", "blocked"]) {
  test(`checkout nationwide address controls and delivery validation follow mode=${mode}`, async () => {
    const fixture = checkoutOptionsFixture({ providers: ["pinelabs"], defaultProvider: "pinelabs", codEnabled: false }, false, mode)
    await new Promise(setImmediate)
    const fields = () => elements(fixture.render())
    fields().find(node => node.type === "button" && node.props.children === "Continue as guest").props.onClick()
    const stateField = () => fields().find(node => node.type === "select" && node.props.id === "state")
    assert.equal(elements(stateField()).some(node => node.type === "option" && node.props.value === "Maharashtra"), mode === "all")
    assert.equal(fields().find(node => node.props?.id === "city").type, mode === "all" ? "input" : "select")
    for (const [name, value] of Object.entries({
      firstName: "Synthetic", email: "fixture@example.invalid", phone: "9876543210",
      address: "Synthetic Test Street", state: "Maharashtra", city: "Mumbai", pincode: "400001",
    })) {
      const input = fields().find(node => node.props?.id === name)
      input.props.onChange({ target: { name, value } })
    }
    const gateway = findElement(fixture.render(), "payment-gateway").props
    assert.equal(await gateway.beforePayment(), mode === "all", JSON.stringify(fixture.errors))
    if (mode === "blocked") assert.ok(fixture.errors.some(error => String(error).includes("Bangalore and Mysore")), JSON.stringify(fixture.errors))
  })
}

test("checkout uses the server default, switches provider handoff, and preserves COD/in-store choices", async () => {
  const config = { providers: ["pinelabs", "razorpay", "paytm"], defaultProvider: "pinelabs", codEnabled: true, instoreEnabled: true }
  const fixture = checkoutOptionsFixture(config)
  await new Promise(setImmediate)
  const options = () => findElement(fixture.render(), "checkout-options").props
  assert.deepEqual(Array.from(options().providers), config.providers)
  assert.equal(options().selected, "pinelabs")
  for (const provider of config.providers) {
    options().onChange(provider)
    const gateway = findElement(fixture.render(), "payment-gateway").props
    assert.equal(options().selected, provider)
    assert.equal(gateway.provider, provider)
    assert.equal(gateway.paymentMethod, "online")
    assert.equal(Object.hasOwn(gateway, "preferredMethod"), false)
  }
  options().onChange("cash-on-delivery")
  assert.equal(options().selected, "cash-on-delivery")
  assert.equal(findElement(fixture.render(), "payment-gateway").props.paymentMethod, "cash-on-delivery")
  options().onChange("instore")
  assert.equal(findElement(fixture.render(), "payment-gateway"), null)
  assert.ok(findElement(fixture.render(), "in-store"))
  options().onChange("pinelabs")
  assert.equal(findElement(fixture.render(), "payment-gateway").props.provider, "pinelabs")
})

for (const fail of [false, true]) {
  test(`checkout never invents an online gateway when none are available (configuration failure=${fail})`, async () => {
    const fixture = checkoutOptionsFixture({ providers: [], defaultProvider: null, codEnabled: true, instoreEnabled: true }, fail)
    await new Promise(setImmediate)
    const options = findElement(fixture.render(), "checkout-options").props
    assert.equal(options.providers.length, 0)
    assert.equal(options.selected, fail ? null : "cash-on-delivery")
    assert.equal(options.codEnabled, !fail)
    assert.equal(options.instoreEnabled, !fail)
    if (fail) assert.equal(fixture.errors.length, 1)
    options.onChange("cash-on-delivery")
    if (fail) {
      assert.equal(findElement(fixture.render(), "checkout-options").props.selected, null)
      assert.equal(findElement(fixture.render(), "in-store"), null)
    } else {
      assert.equal(findElement(fixture.render(), "payment-gateway").props.paymentMethod, "cash-on-delivery")
    }
  })
}

for (const providers of [[], ["pinelabs"]]) {
  test(`disabled COD stays unavailable and selects a valid alternative (gateways=${providers.length})`, async () => {
    const fixture = checkoutOptionsFixture({ providers, defaultProvider: providers[0] ?? null, codEnabled: false, instoreEnabled: true })
    assert.equal(findElement(fixture.render(), "checkout-options").props.codEnabled, false, "Hidden until configuration loads")
    await new Promise(setImmediate)
    const options = () => findElement(fixture.render(), "checkout-options").props
    assert.equal(options().codEnabled, false)
    assert.equal(options().selected, providers[0] ?? "instore")
    options().onChange("cash-on-delivery")
    assert.equal(options().selected, providers[0] ?? "instore")
    assert.ok(!elements(fixture.render()).some(node => typeof node.props?.children === "string" &&
      node.props.children.includes("Choose cash on delivery")))
  })
}

test("COD configuration is strict, returned by the public endpoint, and checked by deployment preflight", async () => {
  const loader = sourceLoader({}, { env: { COD_ENABLED: "false" } })
  const config = loader.load("lib/payment-config.ts")
  assert.equal(config.cashOnDeliveryEnabled(), false)
  assert.equal((await (await loader.load("app/api/payment/config/route.ts").GET()).json()).codEnabled, false)
  loader.env.COD_ENABLED = "true"
  assert.equal(config.cashOnDeliveryEnabled(), true)
  delete loader.env.COD_ENABLED
  assert.equal(config.cashOnDeliveryEnabled(), true, "Retain existing deployments when unset")
  loader.env.COD_ENABLED = "yes"
  assert.throws(() => config.cashOnDeliveryEnabled(), /COD_ENABLED must be true or false/)
  assert.equal((await loader.load("app/api/payment/config/route.ts").GET()).status, 500)
  assert.ok(checkDeploymentEnvironment({ COD_ENABLED: "yes" }).some(error => error.startsWith("COD_ENABLED:")))
  assert.ok(!checkDeploymentEnvironment({ COD_ENABLED: "false" }).some(error => error.startsWith("COD_ENABLED:")))
})

for (const method of ["cash", "cod", "cash-on-delivery", undefined]) {
  test(`disabled COD blocks new ${method ?? "implicit cash"} orders before pricing or persistence`, async () => {
    let pricingCalls = 0
    const loader = sourceLoader({
      "@/lib/auth": { getSession: async () => ({ user: { id: "fixture-user" } }) },
      "@/lib/order-pricing": { priceOrder: async () => { pricingCalls++; return { ok: false, error: "Fixture pricing reached" } } },
    }, { env: { COD_ENABLED: "false" } })
    const route = loader.load("app/api/orders/route.ts")
    const body = { items: [{ id: "fixture", quantity: 1 }], customer: request.customer, paymentMethod: method }
    const response = await route.POST(post(body))
    assert.equal(response.status, 403)
    assert.match((await response.json()).error, /Cash on Delivery is currently unavailable/)
    assert.equal(pricingCalls, 0)
    loader.env.COD_ENABLED = "true"
    const enabledResponse = await route.POST(post(body))
    assert.equal(enabledResponse.status, 400)
    assert.equal((await enabledResponse.json()).error, "Fixture pricing reached")
    assert.equal(pricingCalls, 1)
  })
}

test("native checkout reads the same COD flag and rejects malformed configuration", async () => {
  let value = { codEnabled: false }
  const mobile = sourceLoader({
    "react-native": { Platform: { OS: "android" } },
    "@/api/client": { api: { get: async path => { assert.equal(path, "/api/payment/config"); return value } } },
  }).load("mobile/src/api/checkout.ts")
  assert.equal(await mobile.getCashOnDeliveryEnabled(), false)
  value = { codEnabled: true }
  assert.equal(await mobile.getCashOnDeliveryEnabled(), true)
  value = { codEnabled: "false" }
  await assert.rejects(mobile.getCashOnDeliveryEnabled(), /Payment configuration is unavailable/)
})

for (const provider of ["pinelabs", "paytm"]) {
  test(`browser ${provider} checkout saves a recovery capability before navigating and does not load Razorpay`, async () => {
    const storage = new Map()
    let navigated
    let submitted = false
    const elements = []
    const loader = sourceLoader({
      react: {
        useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }),
        useEffect: effect => effect(),
      },
    }, {
      fetch: async (url, options) => {
        assert.equal(url, "/api/orders")
        assert.equal(JSON.parse(options.body).paymentMethod, provider)
        return Response.json({ success: true, orderId: request.reference, total: 123.45, tax: 18, shipping: 5.45, guestAccessToken: "fixture-guest-capability",
          checkout: { provider, orderId: pineOrder.order_id, checkoutToken: "x".repeat(43),
            redirectUrl: "https://checkout.fixture.invalid",
            ...(provider === "paytm" ? { formFields: { mid: "fixture-mid", txnToken: "fixture-token", orderId: pineOrder.order_id } } : {}) } })
      },
      context: {
        sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        localStorage: { setItem: (key, value) => storage.set(key, value) },
        window: { location: { assign: url => { assert.ok(storage.has("sara_hosted_checkout")); navigated = url } } },
        document: {
          body: { appendChild: () => {} },
          createElement: type => {
            assert.notEqual(type, "script")
            const element = { type, appendChild: child => elements.push(child),
              submit: () => { assert.ok(storage.has("sara_hosted_checkout")); submitted = true } }
            return element
          },
        },
      },
    })
    const tree = loader.load("components/PaymentGateway.tsx").default({
      provider, paymentMethod: "online", amount: 123.45, getHostedOrderData: () => ({ items: [{ id: "fixture", quantity: 1 }] }),
      beforePayment: async () => true,
      onSuccess: () => { throw new Error("Hosted initiation is not a paid order") }, onCancel: () => {},
    })
    await findElement(tree, "form").props.onSubmit({ preventDefault() {} })
    const saved = JSON.parse(storage.get("sara_hosted_checkout"))
    assert.equal(saved.orderId, pineOrder.order_id)
    assert.equal(saved.storeOrderId, request.reference)
    assert.equal(saved.guestAccessToken, "fixture-guest-capability")
    if (provider === "pinelabs") assert.equal(navigated, "https://checkout.fixture.invalid")
    else {
      assert.equal(submitted, true)
      assert.equal(elements.length, 3)
      assert.ok(elements.some(element => element.name === "txnToken" && element.value === "fixture-token"))
    }
  })
}
