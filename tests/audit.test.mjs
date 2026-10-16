import assert from "node:assert/strict"
import test from "node:test"
import crypto from "node:crypto"
import { ObjectId } from "mongodb"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const id = new ObjectId().toString()
const otherId = new ObjectId().toString()
const user = { id, name: "Fixture", email: "fixture@example.invalid", role: "user", sessionVersion: 0 }
const request = (body, route = "/api/test", method = "POST") => new NextRequest(`http://localhost:3010${route}`, {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})
const context = { params: Promise.resolve({ id }) }
const auth = (account = user) => ({
  getSession: async () => account ? { user: account } : null,
  requireUser: async () => account
    ? { ok: true, user: account }
    : { ok: false, response: Response.json({ error: "Authentication required" }, { status: 401 }) },
  requireVendor: async () => ({ ok: true, user: account }),
  requireFullAdmin: async () => account && ["admin", "superadmin"].includes(account.role)
    ? { ok: true, user: account }
    : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) },
  checkAdminAuthorization: async () => ({ authorized: account?.role === "admin" || account?.role === "superadmin" }),
})
const price = {
  ok: true, items: [{ id, name: "Fixture Hardware", price: 100, quantity: 1, type: "hardware",
    image: null, category: null, subCategory: null, provider: null, source: null, kgenProductId: null,
    kgenVariantId: null, packSize: null, validityYears: null, maxDevices: null, validity: null, color: null, size: null }],
  subtotal: 84.75, tax: 15.25, shipping: 0, total: 100, gross: 100, couponDiscount: 0, coupon: null,
}
const pricing = { priceOrder: async () => price }
const noRewards = { quoteRedemption: async () => ({ ok: false, error: "No points" }) }
const mockDb = (collection) => ({
  getCollection: async () => collection,
  normalizeId: (document) => ({ ...document, id: document._id?.toString() }),
  COLLECTIONS: { PRODUCTS: "products", USERS: "users" },
  createObjectId: (value) => new ObjectId(value),
})

test("session signing remains Edge-safe without Buffer or Node crypto", async () => {
  const { createSessionToken, verifySessionToken } = sourceLoader({}, { context: { Buffer: undefined } }).load("lib/session.ts")
  const token = await createSessionToken({ id, email: user.email, role: "user", name: "Unicode fixture \u0c95", sessionVersion: 2 })
  assert.equal((await verifySessionToken(token)).name, "Unicode fixture \u0c95")
  assert.equal((await verifySessionToken(token)).sessionVersion, 2)
  assert.equal(await verifySessionToken(`${token}tampered`), null)
  const expired = await createSessionToken({ id, email: user.email, role: "user", exp: 1 })
  assert.equal(await verifySessionToken(expired), null)
})

test("staff permissions deny unmapped, credential, destructive and employee-management APIs", () => {
  const { staffCanAccessApi } = sourceLoader().load("lib/admin-access.ts")
  const staff = { role: "user", dashboardAccess: true, allowedPages: ["/admin/orders", "/admin/employees"] }
  assert.equal(staffCanAccessApi(staff, "/api/orders"), true)
  for (const route of ["/api/users", "/api/admin/partners", "/api/admin/database/clear", "/api/employees", "/api/new-admin-api"]) {
    assert.equal(staffCanAccessApi(staff, route), false)
  }
  assert.equal(staffCanAccessApi({ role: "admin" }, "/api/new-admin-api"), true)
  assert.equal(staffCanAccessApi({ role: "user", dashboardAccess: false }, "/api/orders"), false)
})

for (const [label, current, version, expected] of [
  ["current active session", user, 0, true],
  ["password-reset session version", { ...user, sessionVersion: 1 }, 0, false],
  ["deleted or inactive account", null, 0, false],
]) {
  test(`server authentication rejects stale identity: ${label}`, async () => {
    const loader = sourceLoader({
      "next/headers": { headers: async () => new Headers(), cookies: async () => ({ get: () => ({ value: "fixture-token" }) }) },
      "@/lib/session": { SESSION_COOKIE: "session", verifySessionToken: async () => ({ ...user, sessionVersion: version }) },
      "@/lib/auth-credentials": { getAuthenticatedUserById: async () => current },
    })
    assert.equal(!!(await loader.load("lib/auth.ts").getSession()), expected)
  })
}

test("a database outage during session lookup is not reported as logged out", async () => {
  const loader = sourceLoader({
    "next/headers": { headers: async () => new Headers(), cookies: async () => ({ get: () => ({ value: "fixture-token" }) }) },
    "@/lib/session": { SESSION_COOKIE: "session", verifySessionToken: async () => user },
    "@/lib/auth-credentials": { getAuthenticatedUserById: async () => { throw new Error("Fixture database outage") } },
  })
  await assert.rejects(() => loader.load("lib/auth.ts").getSession(), /Fixture database outage/)
})

test("server authorization uses live roles instead of stale signed privileges", async () => {
  const loader = sourceLoader({
    "next/headers": { headers: async () => new Headers(), cookies: async () => ({ get: () => ({ value: "fixture-token" }) }) },
    "@/lib/session": { SESSION_COOKIE: "session", verifySessionToken: async () => ({ ...user, role: "superadmin" }) },
    "@/lib/auth-credentials": { getAuthenticatedUserById: async () => user },
  })
  assert.equal((await loader.load("lib/auth.ts").getSession()).user.role, "user")
  assert.equal((await loader.load("lib/auth.ts").requireFullAdmin()).ok, false)
})

test("middleware denies restricted staff on sensitive APIs and overwrites spoofed route headers", async () => {
  const loader = sourceLoader({
    "@/lib/session": { SESSION_COOKIE: "session", verifySessionToken: async () => ({ ...user, dashboardAccess: true, allowedPages: ["/admin/orders"] }) },
  })
  const middleware = loader.load("middleware.ts").middleware
  const denied = await middleware(new NextRequest("http://localhost:3010/api/admin/partners"))
  assert.equal(denied.status, 403)
  const allowed = await middleware(new NextRequest("http://localhost:3010/api/orders", {
    headers: { "x-sara-request-path": "/api/users" },
  }))
  assert.equal(allowed.headers.get("x-middleware-request-x-sara-request-path"), "/api/orders")
})

for (const input of [{ storeAccess: "all" }, { "allowedPages.0": "/admin/employees" }, { role: "superadmin" }, { resetPasswordToken: "arbitrary" }]) {
  test(`profile allowlist rejects ${Object.keys(input)[0]} before any write`, async () => {
    let writes = 0
    const loader = sourceLoader({
      "@/lib/auth": auth(),
      "@/lib/db-service": mockDb({ updateOne: async () => { writes++; } }),
    })
    const result = await loader.load("app/api/users/[id]/route.ts").PATCH(request(input), context)
    assert.equal(result.status, 400)
    assert.equal(writes, 0)
  })
}

test("valid self-profile updates preserve only parsed fields and strip recovery credentials", async () => {
  let update
  const loader = sourceLoader({
    "@/lib/auth": auth(),
    "@/lib/db-service": mockDb({
      findOne: async () => ({ _id: new ObjectId(id), role: "user", name: "Fixture", password: "redacted", resetPasswordToken: "redacted" }),
      updateOne: async (_query, data) => { update = data; return { matchedCount: 1 } },
    }),
  })
  const response = await loader.load("app/api/users/[id]/route.ts").PATCH(request({ name: "Updated Fixture" }), context)
  assert.equal(response.status, 200)
  assert.equal(update.$set.name, "Updated Fixture")
  assert.equal("password" in await response.json(), false)
})

test("restricted staff cannot create users or superadmins", async () => {
  const loader = sourceLoader({ "@/lib/auth": auth({ ...user, dashboardAccess: true }) })
  assert.equal((await loader.load("app/api/users/route.ts").POST(request({}))).status, 403)
})

test("a full admin still cannot create a superadmin", async () => {
  const loader = sourceLoader({ "@/lib/auth": auth({ ...user, role: "admin" }) })
  const response = await loader.load("app/api/users/route.ts").POST(request({
    email: "fixture@example.invalid", name: "Fixture", password: `Aa1!${crypto.randomBytes(16).toString("hex")}`, role: "superadmin",
  }))
  assert.equal(response.status, 403)
})

test("vendor filters constrain ownership for every id representation", () => {
  const { vendorProductFilter } = sourceLoader().load("lib/vendor-products.ts")
  const vendor = { id, role: "vendor" }
  for (const key of [id, "fixture-string-id"]) {
    const query = vendorProductFilter(key, vendor)
    assert.equal(query.$and[1].vendorId, id)
    assert.ok(query.$and[0].$or.some((entry) => entry._id === key))
  }
  assert.ok(vendorProductFilter(id, { id: otherId, role: "admin" }).$or)
})

test("vendor update and deletion use an atomic ownership filter, not an unscoped helper", async () => {
  const filters = []
  const loader = sourceLoader({
    "@/lib/auth": auth({ ...user, role: "vendor" }),
    "@/lib/db-service": mockDb({
      findOneAndUpdate: async (filter) => { filters.push(filter); return null },
      deleteOne: async (filter) => { filters.push(filter); return { deletedCount: 0 } },
    }),
  })
  const route = loader.load("app/api/vendor/products/[id]/route.ts")
  assert.equal((await route.PUT(request({ name: "Fixture", description: "Fixture", price: 1, stock: 1 }), context)).status, 404)
  assert.equal((await route.DELETE(request({}, "/api/test", "DELETE"), context)).status, 404)
  assert.equal(filters.length, 2)
  for (const filter of filters) assert.equal(filter.$and[1].vendorId, id)
})

test("anonymous invoice requests fail before loading any order", async () => {
  const loader = sourceLoader({ "@/lib/auth": auth(null) })
  const response = await loader.load("app/api/orders/[id]/invoice/route.ts").GET(
    new NextRequest(`http://localhost:3010/api/orders/${id}/invoice`), context,
  )
  assert.equal(response.status, 401)
})

test("another customer's invoice remains undisclosed", async () => {
  const loader = sourceLoader({
    "@/lib/auth": auth(),
    "@/lib/db-service": mockDb({ findOne: async () => ({ _id: new ObjectId(id), userId: otherId }) }),
  })
  const response = await loader.load("app/api/orders/[id]/invoice/route.ts").GET(
    new NextRequest(`http://localhost:3010/api/orders/${id}/invoice`), context,
  )
  assert.equal(response.status, 404)
})

test("both native Google resolution and onboarding reject disabled accounts", async () => {
  let writes = 0
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      findOne: async () => ({ _id: new ObjectId(id), status: "inactive", role: "superadmin" }),
      updateOne: async () => { writes++ },
    }) } }) },
  })
  const route = loader.load("lib/auth-google.ts")
  assert.equal((await route.resolveGoogleUser({ email: user.email })).status, "inactive")
  assert.equal((await route.createGoogleUser({ email: user.email }, {})).ok, false)
  assert.equal(writes, 0)
})

test("web Google callback does not issue a session to disabled staff or accounts with invalid roles", async () => {
  let signed = 0
  let account = { _id: new ObjectId(id), email: user.email, status: "inactive", role: "superadmin", authProvider: "google" }
  const loader = sourceLoader({
    "@/lib/session": { createSessionToken: async () => { signed++; }, SESSION_COOKIE: "session", SESSION_MAX_AGE: 86400 },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      findOne: async () => account,
    }) } }) },
  }, { fetch: async (url) => Response.json(String(url).includes("/token")
    ? { access_token: "fixture-provider-token" }
    : { email: user.email, verified_email: true }) })
  const response = await loader.load("app/api/auth/google/callback/route.ts").GET(
    new NextRequest("http://localhost:3010/api/auth/google/callback?code=fixture"),
  )
  assert.match(response.headers.get("location"), /account_inactive/)
  assert.equal(signed, 0)
  account = { ...account, status: "active", role: "unknown-role" }
  const invalid = await loader.load("app/api/auth/google/callback/route.ts").GET(
    new NextRequest("http://localhost:3010/api/auth/google/callback?code=fixture"),
  )
  assert.match(invalid.headers.get("location"), /account_invalid/)
  assert.equal(signed, 0)
})

test("password reset atomically retires its token and invalidates access/refresh sessions", async () => {
  let update
  let revocation
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      findOne: async () => ({ _id: new ObjectId(id) }),
      updateOne: async (filter, data) => { update = { filter, data }; return { matchedCount: 1 } },
    }) } }) },
    "@/lib/refresh-tokens": { revokeAllForUser: async (...args) => { revocation = args } },
  })
  const response = await loader.load("app/api/auth/reset-password/route.ts").POST(request({
    token: crypto.randomBytes(32).toString("hex"), password: `Aa1!${crypto.randomBytes(16).toString("hex")}`,
  }))
  assert.equal(response.status, 200)
  assert.equal(update.data.$inc.sessionVersion, 1)
  assert.ok(update.filter.resetPasswordToken)
  assert.deepEqual(revocation, [id, "password_reset"])
})

test("refresh rotation rejects pre-reset tokens without issuing replacements", async () => {
  let writes = 0
  const loader = sourceLoader({
    "@/lib/db-service": mockDb({
      findOne: async () => ({ userId: id, familyId: "fixture", expiresAt: new Date(Date.now() + 60000), sessionVersion: 0 }),
      updateMany: async () => ({ modifiedCount: 1 }), insertOne: async () => { writes++ },
    }),
    "@/lib/auth-credentials": { getAuthenticatedUserById: async () => ({ ...user, sessionVersion: 1 }) },
  })
  assert.equal((await loader.load("lib/refresh-tokens.ts").rotateRefreshToken("fixture-refresh")).ok, false)
  assert.equal(writes, 0)
})

for (const [label, change] of [
  ["authorized but not captured", { status: "authorized" }],
  ["different provider order", { order_id: "unrelated-order" }],
  ["wrong amount by one paisa", { amount: 9999 }],
  ["different currency", { currency: "USD" }],
]) {
  test(`provider verification rejects ${label}`, async () => {
    const loader = sourceLoader({
      razorpay: class { payments = { fetch: async () => ({ status: "captured", amount: 10000, currency: "INR", order_id: "fixture-order", ...change }) } },
    }, { env: { RAZORPAY_KEY_ID: crypto.randomUUID() } })
    assert.equal((await loader.load("lib/razorpay.ts").verifyRazorpayPayment("fixture-payment", 100, "fixture-order")).verified, false)
  })
}

test("provider verification accepts only the exact captured checkout", async () => {
  const loader = sourceLoader({
    razorpay: class { payments = { fetch: async () => ({ status: "captured", amount: 10000, currency: "INR", order_id: "fixture-order" }) } },
  }, { env: { RAZORPAY_KEY_ID: crypto.randomUUID() } })
  assert.equal((await loader.load("lib/razorpay.ts").verifyRazorpayPayment("fixture-payment", 100, "fixture-order")).verified, true)
})

test("checkout fingerprint binds items, quantities, price, fulfilment and rewards", () => {
  const { checkoutFingerprint } = sourceLoader().load("lib/checkout-payment.ts")
  const original = checkoutFingerprint(price, {}, 100)
  assert.notEqual(original, checkoutFingerprint({ ...price, items: [{ ...price.items[0], quantity: 2 }] }, {}, 100))
  assert.notEqual(original, checkoutFingerprint(price, { fulfilment: { method: "pickup", storeId: id } }, 100))
  assert.notEqual(original, checkoutFingerprint(price, { redeemPoints: 100 }, 100))
  assert.notEqual(original, checkoutFingerprint(price, {}, 99))
})

test("payment verification cannot create caller-selected software orders or hand out licenses", async () => {
  let writes = 0
  const loader = sourceLoader({
    "@/lib/auth": auth(),
    "@/lib/checkout-payment": { getCheckoutIntent: async () => null },
    "@/lib/db-service": mockDb({ insertOne: async () => { writes++ } }),
  })
  const response = await loader.load("app/api/payment/verify/route.ts").POST(request({
    razorpay_order_id: "cheap-order", razorpay_payment_id: "cheap-payment",
    razorpay_signature: "a".repeat(64), checkoutToken: "x".repeat(43),
    orderDetails: { items: [{ id, type: "software", price: 100000 }] },
  }))
  assert.equal(response.status, 409)
  assert.equal(writes, 0)
})

test("payment-provider failure cannot fall back to a client-supplied amount", async () => {
  let writes = 0
  const loader = sourceLoader({
    "@/lib/auth": auth(),
    "@/lib/checkout-payment": { getCheckoutIntent: async () => ({ _id: "fixture-order", amount: 10000, currency: "INR", method: "razorpay", status: "created" }) },
    "@/lib/razorpay": { verifyRazorpayPayment: async () => ({ verified: false, reason: "verification_error" }) },
    "@/lib/db-service": mockDb({ updateOne: async () => { writes++; } }),
  })
  const signature = crypto.createHmac("sha256", loader.env.RAZORPAY_KEY_SECRET).update("fixture-order|fixture-payment").digest("hex")
  const response = await loader.load("app/api/payment/verify/route.ts").POST(request({
    razorpay_order_id: "fixture-order", razorpay_payment_id: "fixture-payment", razorpay_signature: signature,
    checkoutToken: "x".repeat(43), orderDetails: { amount: 1 },
  }))
  assert.equal(response.status, 503)
  assert.equal(writes, 0)
})

test("catalogue pricing ignores forged software type and upstream identifiers", async () => {
  const loader = sourceLoader({
    "@/lib/db-service": {
      COLLECTIONS: { PRODUCTS: "products" },
      getCollection: async (name) => name === "settings"
        ? { findOne: async () => ({ shippingFee: 99, freeShippingThreshold: 1000 }) }
        : { find: () => ({ toArray: async () => name === "products" ? [{ _id: new ObjectId(id), name: "Hardware", price: 100, stock: 1 }] : [] }) },
    },
  })
  const result = await loader.load("lib/order-pricing.ts").priceOrder([{
    id, quantity: 1, type: "software", provider: "exlr8", kgenProductId: "attacker-choice", validityYears: 99,
  }], { userId: null })
  assert.equal(result.ok, true)
  assert.equal(result.items[0].type, "hardware")
  assert.equal(result.items[0].provider, null)
  assert.equal(result.items[0].kgenProductId, null)
  assert.equal(result.shipping, 99)
})

test("external fulfillment refuses unpaid orders before contacting any provider", async () => {
  const loader = sourceLoader({ "@/lib/db-service": mockDb({
    findOne: async () => ({ _id: new ObjectId(id), status: "pending", paymentVerification: { verified: false }, items: [] }),
  }) })
  await assert.rejects(loader.load("lib/external-fulfillment.ts").fulfillExternalOrder(id), /Verified payment/)
})

for (const endpoint of ["place-order", "queue-order"]) {
  test(`external ${endpoint} cannot operate on another user's order or trust submitted items`, async () => {
    let calls = 0
    class FulfillmentError extends Error {}
    const loader = sourceLoader({
      "@/lib/auth": auth(),
      "@/lib/external-fulfillment": {
        getFulfillmentOrder: async () => ({ _id: new ObjectId(id), userId: otherId }),
        fulfillExternalOrder: async () => { calls++ },
        queueExternalOrder: async () => { calls++ },
        FulfillmentError,
      },
    })
    const result = await loader.load(`app/api/integrations/exlr8/${endpoint}/route.ts`).POST(request({
      orderId: id, userId: otherId, items: [{ productId: "attacker-choice" }],
    }))
    assert.equal(result.status, 404)
    assert.equal(calls, 0)
  })
}

test("in-store OTP rejects nonexistent employees before sending an email", async () => {
  let mails = 0
  const loader = sourceLoader({
    "@/lib/auth": auth(null),
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { AUTH: {} } },
    "@/lib/db-service": mockDb({ findOne: async () => null }),
    "@/lib/email": { sendEmail: async () => { mails++; return { success: true } } },
  })
  const result = await loader.load("app/api/auth/store-purchase/route.ts").POST(request({
    email: "attacker@example.invalid", employeeId: "fixture", action: "verify", checkout: { items: [{ id, quantity: 1 }] },
  }))
  assert.equal(result.status, 400)
  assert.equal(mails, 0)
})

test("in-store approval validates its checkout challenge, not an email-only OTP", async () => {
  const loader = sourceLoader({
    "@/lib/auth": auth(),
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { AUTH: {} } },
    "@/lib/db-service": mockDb({ findOne: async () => ({ email: user.email }), findOneAndUpdate: async () => null }),
    "@/lib/checkout-payment": {
      ...sourceLoader({ "@/lib/order-pricing": pricing, "@/lib/loyalty": noRewards }).load("lib/checkout-payment.ts"),
      quoteCheckout: async () => ({ ok: true, ...price, pricing: price, amount: 100, fingerprint: "fixture-checkout" }),
    },
  })
  const result = await loader.load("app/api/auth/store-purchase/route.ts").POST(request({
    email: user.email, employeeId: "fixture", action: "validate", otp: "123456",
    challengeId: crypto.randomUUID(), checkout: { items: [{ id, quantity: 1 }] },
  }))
  assert.equal(result.status, 400)
})

function orderLoader({ intent = null, verified = true, account = user, priced = price, couponResult = { ok: true } } = {}) {
  let writes = 0
  let persisted
  const cartClears = []
  const consumptions = []
  const adminNotifications = []
  const transaction = { fixture: true }
  const orderPricing = {
    priceOrder: async () => priced,
    consumeOrderCoupon: async (...args) => { consumptions.push(args); return couponResult },
  }
  const loader = sourceLoader({
    "@/lib/auth": auth(account),
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { ORDERS: {} } },
    "@/lib/order-pricing": orderPricing,
    "@/lib/order-id": { generateOrderId: async () => "FIXTURE-ORDER" },
    "@/lib/loyalty": { ...noRewards, reverseOrderPoints: async () => {}, redeemPoints: async () => ({ ok: true }) },
    "@/lib/software-fulfillment": { fulfillSoftwareOrder: async () => { throw new Error("Fulfillment must not execute in this test") } },
    "@/lib/external-fulfillment": { fulfillExternalOrder: async () => {}, queueExternalOrder: async () => {} },
    "@/lib/checkout-payment": {
      ...sourceLoader({ "@/lib/order-pricing": orderPricing, "@/lib/loyalty": noRewards }).load("lib/checkout-payment.ts"),
      getCheckoutIntent: async () => intent,
      persistCheckoutOrder: async (order, _intent, beforeInsert) => {
        if (beforeInsert) await beforeInsert(transaction)
        writes++; persisted = order; return new ObjectId()
      },
    },
    "@/lib/razorpay": { verifyRazorpayPayment: async () => ({ verified, amountPaid: 100 }) },
    "@/lib/order-notifications": { notifyAdminOrder: async (...args) => { adminNotifications.push(args); return { status: "sent" } } },
    "@/lib/db-service": {
      ...mockDb({}),
      getCollection: async (name) => ({
        findOne: async () => ({ employeeId: "fixture", email: user.email }),
        find: () => ({ toArray: async () => [] }),
        updateOne: async () => { if (name === "carts") cartClears.push(name); return { matchedCount: 1 } },
      }),
    },
    "@/lib/emailTemplates": { emailTemplates: { ORDER_PENDING: { subject: "Fixture #{orderNumber}", html: () => "<p>Fixture</p>" } } },
  })
  return { route: loader.load("app/api/orders/route.ts"), writes: () => writes, persisted: () => persisted, cartClears, consumptions, transaction, adminNotifications }
}

const orderBody = {
  items: [{ id, quantity: 1 }],
  customer: { email: user.email, name: "Fixture", phone: "0000000000" },
}

test("standard checkout rejects reusable payment references without a verified bound intent", async () => {
  const fixture = orderLoader()
  const response = await fixture.route.POST(request({
    ...orderBody, paymentMethod: "razorpay",
    paymentDetails: { paymentId: "fixture-payment", orderId: "fixture-order", checkoutToken: "x".repeat(43) },
  }))
  assert.equal(response.status, 409)
  assert.equal(fixture.writes(), 0)
})

test("in-store checkout cannot be confirmed using only an employee ID", async () => {
  const fixture = orderLoader()
  const response = await fixture.route.POST(request({
    ...orderBody, paymentMethod: "instore", paymentDetails: { employeeId: "fixture", verifiedEmail: user.email },
  }))
  assert.equal(response.status, 400)
  assert.equal(fixture.writes(), 0)
})

test("verified payment for different merchandise is rejected before order persistence", async () => {
  const fixture = orderLoader({ intent: {
    _id: "fixture-order", method: "razorpay", status: "verified",
    paymentId: "fixture-payment", amount: 10000, fingerprint: "different-items",
  } })
  const response = await fixture.route.POST(request({
    ...orderBody, paymentMethod: "razorpay",
    paymentDetails: { paymentId: "fixture-payment", orderId: "fixture-order", checkoutToken: "x".repeat(43) },
  }))
  assert.equal(response.status, 409)
  assert.equal(fixture.writes(), 0)
})

test("a consumed payment intent cannot create another order", async () => {
  const fixture = orderLoader({ intent: {
    _id: "fixture-order", method: "razorpay", status: "consumed",
    paymentId: "fixture-payment", amount: 10000,
  } })
  const response = await fixture.route.POST(request({
    ...orderBody, paymentMethod: "razorpay",
    paymentDetails: { paymentId: "fixture-payment", orderId: "fixture-order", checkoutToken: "x".repeat(43) },
  }))
  assert.equal(response.status, 409)
  assert.equal(fixture.writes(), 0)
})

test("authenticated cash checkout persists server pricing as unpaid and clears the real cart collection", async () => {
  const fixture = orderLoader()
  const response = await fixture.route.POST(request({ ...orderBody, paymentMethod: "cash", total: 1 }))
  assert.equal(response.status, 200)
  assert.equal(fixture.writes(), 1)
  assert.equal(fixture.persisted().total, 100)
  assert.equal(fixture.persisted().status, "pending")
  assert.equal(fixture.persisted().paymentVerification.verified, false)
  assert.deepEqual(fixture.cartClears, ["carts"])
  assert.equal(fixture.adminNotifications[0][2], "created")
})

for (const accepted of [true, false]) {
  test(`order handler ${accepted ? "commits" : "aborts"} coupon consumption through its transaction callback`, async () => {
    const coupon = { code: "FIXTURE", name: "Fixture", discount: 5 }
    const fixture = orderLoader({
      priced: { ...price, coupon, couponDiscount: 5, total: 95 },
      couponResult: accepted ? { ok: true } : { ok: false, error: "Coupon usage limit reached" },
    })
    const response = await fixture.route.POST(request({
      ...orderBody, paymentMethod: "cash", coupon: { ...coupon, discount: 999 }, userId: "spoofed",
    }))
    assert.equal(response.status, accepted ? 200 : 409)
    assert.equal(fixture.consumptions.length, 1)
    const [items, expected, identity, transaction] = fixture.consumptions[0]
    assert.equal(items[0].id, id)
    assert.equal(expected.discount, 5)
    assert.equal(identity, user.id)
    assert.equal(transaction, fixture.transaction)
    assert.equal(fixture.writes(), accepted ? 1 : 0)
    if (accepted) assert.equal(fixture.persisted().total, 95)
    else assert.equal(fixture.cartClears.length, 0)
  })
}

test("guest checkout returns a private capability once without leaking its stored hash", async () => {
  const fixture = orderLoader({ account: null })
  const response = await fixture.route.POST(request({ ...orderBody, paymentMethod: "cod" }))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(typeof result.guestAccessToken, "string")
  assert.equal(result.order.isGuest, true)
  assert.equal("guestAccessTokenHash" in result.order, false)
  assert.equal(fixture.persisted().userId, null)
})

for (const method of ["razorpay", "instore"]) {
  test(`valid checkout-bound ${method} approval still confirms the exact stored merchandise`, async () => {
    const fingerprint = sourceLoader().load("lib/checkout-payment.ts").checkoutFingerprint(price, {}, 100)
    const fixture = orderLoader({ intent: {
      _id: "fixture-order", method, status: "verified", amount: 10000, fingerprint,
      paymentId: "fixture-payment", employeeId: "fixture", employeeEmail: user.email,
    } })
    const response = await fixture.route.POST(request({
      ...orderBody, paymentMethod: method,
      paymentDetails: method === "razorpay"
        ? { paymentId: "fixture-payment", orderId: "fixture-order", checkoutToken: "x".repeat(43) }
        : { approvalId: "fixture-order", approvalToken: "x".repeat(43) },
    }))
    assert.equal(response.status, 200)
    assert.equal(fixture.writes(), 1)
    assert.equal(fixture.persisted().status, "confirmed")
    assert.equal(fixture.persisted().paymentVerification.verified, true)
    assert.equal(fixture.persisted().items[0].name, "Fixture Hardware")
    assert.equal(fixture.adminNotifications.length, 1)
    assert.equal(fixture.adminNotifications[0][2], "confirmed")
  })
}

test("valid employee OTP creates a checkout-bound single-use approval without sending a real email", async () => {
  const challengeId = crypto.randomUUID()
  const secret = crypto.randomBytes(32).toString("hex")
  const fingerprint = "fixture-checkout"
  let consumed
  let approval
  const challenge = {
    _id: challengeId,
    otpHash: crypto.createHmac("sha256", secret).update(`${challengeId}:123456`).digest("hex"),
  }
  const loader = sourceLoader({
    "@/lib/auth": auth(),
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { AUTH: {} } },
    "@/lib/db-service": {
      getCollection: async (name) => name === "employees"
        ? { findOne: async () => ({ employeeId: "fixture", email: user.email }) }
        : name === "store_purchase_challenges"
          ? {
            findOneAndUpdate: async (filter) => {
              assert.equal(filter.fingerprint, fingerprint)
              assert.equal(filter.userId, id)
              return challenge
            },
            updateOne: async (filter) => { consumed = filter; return { modifiedCount: 1 } },
          }
          : { updateOne: async (_filter, update) => { approval = update.$set; return { modifiedCount: 1 } } },
    },
    "@/lib/checkout-payment": {
      CheckoutQuoteSchema: sourceLoader().load("lib/checkout-payment.ts").CheckoutQuoteSchema,
      quoteCheckout: async () => ({ ok: true, pricing: price, amount: 100, fingerprint }),
      createCheckoutIntent: async (_id, owner, quote, method) => {
        assert.equal(owner, id)
        assert.equal(quote.fingerprint, fingerprint)
        assert.equal(method, "instore")
        return "fixture-approval-token"
      },
    },
  }, { env: { SESSION_SECRET: secret } })
  const result = await loader.load("app/api/auth/store-purchase/route.ts").POST(request({
    email: user.email, employeeId: "fixture", action: "validate", otp: "123456",
    challengeId, checkout: { items: [{ id, quantity: 1 }] },
  }))
  assert.equal(result.status, 200)
  assert.equal(consumed.consumed, false)
  assert.equal(approval.status, "verified")
  assert.equal((await result.json()).approvalToken, "fixture-approval-token")
})

for (const [label, account, guest] of [["owner", user, false], ["guest token holder", null, true]]) {
  test(`${label} can download a genuine PDF with stored tax-exclusive subtotal and accurate payment state`, async () => {
    const { createGuestAccessToken, hashGuestAccessToken } = sourceLoader().load("lib/guest-order.ts")
    const token = createGuestAccessToken()
    const loader = sourceLoader({
      "@/lib/auth": auth(account),
      "@/lib/db-service": mockDb({
        findOne: async () => ({
          _id: new ObjectId(id), userId: guest ? null : id, guestAccessTokenHash: hashGuestAccessToken(token),
          customer: { name: "Fixture", email: user.email }, createdAt: new Date(),
          paymentMethod: "cash", paymentVerification: { verified: false }, status: "pending",
          subtotal: 84.75, tax: 15.25, total: 90, coupon: { discount: 5 }, loyalty: { discount: 5 },
          items: [{ name: "Fixture Hardware", quantity: 1, price: 100 }],
        }),
      }),
    })
    const response = await loader.load("app/api/orders/[id]/invoice/route.ts").GET(
      new NextRequest(`http://localhost:3010/api/orders/${id}/invoice${guest ? `?token=${token}` : ""}`), context,
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), "application/pdf")
    const pdf = new Uint8Array(await response.arrayBuffer())
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), "%PDF-")
    const { extractText } = await import("unpdf")
    const { text } = await extractText(pdf, { mergePages: true })
    assert.match(text, /84\.75/)
    assert.match(text, /15\.25/)
    assert.match(text, /COD/)
    assert.doesNotMatch(text, /Payment has been received and confirmed/)
  })
}

function consentFixture(fetcher = async () => ({ ok: true })) {
  const storage = new Map()
  const window = new EventTarget()
  let reloads = 0
  const errors = []
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  }
  window.location = { reload: () => { reloads++ } }
  const loader = sourceLoader({}, {
    fetch: fetcher,
    context: { window, CustomEvent, console: { ...console, error: (message) => errors.push(message) } },
  })
  const consent = loader.load("lib/consent-client.ts")
  return { consent, window, storage, errors, reloads: () => reloads }
}

test("tracking denies malformed records and validates each category independently", () => {
  const fixture = consentFixture()
  const record = fixture.consent.writeConsent({ analytics: true })
  assert.equal(fixture.consent.hasConsent("analytics"), true)
  assert.equal(fixture.consent.hasConsent("advertising"), false)
  fixture.storage.set(fixture.consent.CONSENT_STORAGE_KEY, JSON.stringify({ ...record, advertising: "true" }))
  assert.equal(fixture.consent.readConsent(), null)
  assert.equal(fixture.consent.hasConsent("analytics"), false)
})

test("reset broadcasts denial, reopens subscribers and stops loaded trackers by reloading", () => {
  const fixture = consentFixture()
  fixture.consent.writeConsent({ analytics: true })
  let latest = "unchanged"
  const unsubscribe = fixture.consent.onConsentChange((value) => { latest = value })
  fixture.consent.resetConsent()
  assert.equal(latest, null)
  assert.equal(fixture.consent.hasConsent("analytics"), false)
  assert.equal(fixture.reloads(), 1)
  unsubscribe()
})

test("withdrawal persists denial before reloading; granting consent does not reload", () => {
  const fixture = consentFixture()
  fixture.consent.writeConsent({ analytics: true, advertising: true })
  assert.equal(fixture.reloads(), 0)
  fixture.consent.writeConsent({ analytics: true, advertising: false })
  assert.equal(fixture.consent.hasConsent("advertising"), false)
  assert.equal(fixture.reloads(), 1)
})

test("cross-tab consent removal updates gates and reloads loaded trackers", () => {
  const fixture = consentFixture()
  fixture.consent.writeConsent({ advertising: true })
  let notified = false
  const unsubscribe = fixture.consent.onConsentChange((value) => { notified = value === null })
  fixture.storage.delete(fixture.consent.CONSENT_STORAGE_KEY)
  const event = new Event("storage")
  Object.defineProperty(event, "key", { value: fixture.consent.CONSENT_STORAGE_KEY })
  fixture.window.dispatchEvent(event)
  assert.equal(notified, true)
  assert.equal(fixture.reloads(), 1)
  unsubscribe()
})

test("failed consent ledger requests are handled and explicitly reported", async () => {
  for (const fetcher of [async () => { throw new Error("Injected offline error") }, async () => ({ ok: false })]) {
    const fixture = consentFixture(fetcher)
    fixture.consent.writeConsent({ analytics: false })
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(fixture.errors.length, 1)
    assert.equal(fixture.consent.hasConsent("analytics"), false)
  }
})

for (const [analytics, advertising, expected] of [
  [false, false, []],
  [true, false, ["ga4-src", "ga4-init", "ms-clarity"]],
  [false, true, ["meta-pixel"]],
  [true, true, ["ga4-src", "ga4-init", "meta-pixel", "ms-clarity"]],
]) {
  test(`marketing tags respect granular consent analytics=${analytics}, advertising=${advertising}`, () => {
    const loader = sourceLoader({
      "next/script": (props) => React.createElement("script", { id: props.id }),
      "@/components/ConsentGate": ({ category, children }) => ({ analytics, advertising })[category] ? children : null,
    }, { env: { NEXT_PUBLIC_GA_ID: "G-FIXTURE", NEXT_PUBLIC_META_PIXEL_ID: "fixture", NEXT_PUBLIC_CLARITY_ID: "fixture" } })
    const markup = renderToStaticMarkup(React.createElement(loader.load("components/MarketingTags.tsx").default))
    for (const tag of ["ga4-src", "ga4-init", "meta-pixel", "ms-clarity"]) {
      assert.equal(markup.includes(`id="${tag}"`), expected.includes(tag), tag)
    }
  })
}

test("a configurable GTM container requires both analytics and advertising consent", () => {
  for (const [analytics, advertising] of [[false, false], [true, false], [false, true], [true, true]]) {
    const loader = sourceLoader({
      "next/script": (props) => React.createElement("script", { id: props.id }),
      "@/components/ConsentGate": ({ category, children }) => ({ analytics, advertising })[category] ? children : null,
    }, { env: { NEXT_PUBLIC_GTM_ID: "GTM-FIXTURE", NEXT_PUBLIC_GA_ID: "G-FIXTURE" } })
    const markup = renderToStaticMarkup(React.createElement(loader.load("components/MarketingTags.tsx").default))
    assert.equal(markup.includes('id="gtm-init"'), analytics && advertising)
    assert.equal(markup.includes('id="ga4-init"'), false)
  }
})

test("the public health endpoint neither reads statistics nor exposes connection errors", async () => {
  let statsCalls = 0
  const healthy = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: {
      admin: () => ({ ping: async () => ({ ok: 1 }) }),
      stats: async () => { statsCalls++; return { collections: 123 } },
    } }) },
  })
  const response = await healthy.load("app/api/health/route.ts").GET()
  assert.equal(response.status, 200)
  assert.equal("collections" in await response.json(), false)
  assert.equal(statsCalls, 0)
  const unhealthy = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => { throw new Error("Injected private hostname") } },
  }, { context: { console: { ...console, error: () => {} } } })
  const failure = await unhealthy.load("app/api/health/route.ts").GET()
  assert.equal(failure.status, 500)
  assert.equal((await failure.json()).error, "Database unavailable")
})

for (const method of ["cash", "online"]) {
  test(`native ${method} checkout preserves the shared checkout contract without real provider calls`, async () => {
    const calls = []
    const loader = sourceLoader({
      "react-native": { Platform: { OS: "android" } },
      "@/api/client": { api: { post: async (route, body) => {
        calls.push({ route, body })
        return route === "/api/payment/create-order"
          ? { orderId: "fixture-order", amount: 10000, currency: "INR", keyId: "fixture-key", checkoutToken: "fixture-bound-token" }
          : { success: true, orderId: "FIXTURE-ORDER" }
      } } },
      "react-native-razorpay": { __esModule: true, default: { open: async () => ({
        razorpay_order_id: "fixture-order", razorpay_payment_id: "fixture-payment", razorpay_signature: "fixture-signature",
      }) } },
    })
    const result = await loader.load("mobile/src/api/checkout.ts").placeOrder({
      items: [{ id, quantity: 1 }], paymentMethod: method,
      customer: { ...orderBody.customer, firstName: "Fixture", lastName: "", address: "", city: "", state: "", zipCode: "" },
    })
    assert.equal(result.orderId, "FIXTURE-ORDER")
    if (method === "cash") {
      assert.equal(calls.length, 1)
      assert.equal(calls[0].route, "/api/orders")
    } else {
      assert.equal(calls.length, 3)
      assert.equal(calls[1].route, "/api/payment/verify")
      assert.equal(calls[1].body.checkoutToken, "fixture-bound-token")
      assert.equal(calls[2].body.paymentDetails.checkoutToken, "fixture-bound-token")
      assert.equal(calls[2].body.paymentDetails.orderId, "fixture-order")
    }

  })
}

function exportFixture({ records = [], failure = null, consentFailure = false } = {}) {
  return sourceLoader({
    "@/lib/auth": auth(),
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: (name) => ({
      findOne: async () => ({ _id: new ObjectId(id), email: user.email, password: "fixture-private" }),
      find: (filter) => {
        assert.equal(name === "leads" || name === "contact_inquiries" ? filter.email : filter.userId,
          name === "leads" || name === "contact_inquiries" ? user.email : id)
        return { limit: (limit) => ({ toArray: async () => {
          assert.equal(limit, 5001)
          if (name === failure) throw new Error("Injected export collection failure")
          return name === "orders" ? records : []
        } }) }
      },
    }) } }) },
    "@/lib/consent": { getConsentHistory: async () => {
      if (consentFailure) throw new Error("Injected consent ledger failure")
      return []
    } },
  }, { context: { console: { ...console, error: () => {} } } })
}

for (const count of [5000, 5001]) {
  test(`personal-data export identifies the exact ${count}-record completeness boundary`, async () => {
    const loader = exportFixture({ records: Array.from({ length: count }, () => ({
      userId: id, nested: { resetPasswordToken: "fixture-private", name: "Fixture" },
    })) })
    const result = await loader.load("app/api/account/export/route.ts").GET(new NextRequest("http://localhost:3010/api/account/export"))
    assert.equal(result.status, 200)
    const body = await result.json()
    assert.equal(body.export.partial, count > 5000)
    assert.equal(body.data.orders.truncated, count > 5000)
    assert.equal(body.data.orders.records.length, 5000)
    assert.equal("password" in body.account, false)
    assert.equal("resetPasswordToken" in body.data.orders.records[0].nested, false)
  })
}

for (const options of [{ failure: "orders" }, { consentFailure: true }]) {
  test(`personal-data export reports ${options.failure ? "collection" : "consent ledger"} failure instead of returning an incomplete success`, async () => {
    const loader = exportFixture(options)
    const response = await loader.load("app/api/account/export/route.ts").GET(new NextRequest("http://localhost:3010/api/account/export"))
    assert.equal(response.status, 500)
    assert.equal((await response.json()).error, "Could not generate your data export.")
  })
}
