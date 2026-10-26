import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const storeId = new ObjectId().toString()
const store = { id: storeId, name: "Fixture Store", phone: "9876543210", email: "store@example.invalid", address: "Fixture Road" }
const customer = { name: "Arun Kumar", email: "shopper@example.com", phone: "9123456780", address: "1 Fixture Street", city: "Bengaluru", state: "Karnataka", zipCode: "560001", country: "India" }
const quote = {
  ok: true, amount: 1234, fingerprint: "fixture-fingerprint",
  pricing: { items: [{ id: "p1", name: "Fixture TV", price: 1234, quantity: 1 }], total: 1234 },
}
const post = (body, path = "/api/payment/store-request") => new NextRequest(`https://fixture.invalid${path}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})
const requestBody = { items: [{ id: "p1", quantity: 1 }], fulfilment: { method: "pickup", storeId }, storeId, customer }

function requestLoader({ env = {}, loaded = store, limited = false, stocked = true } = {}) {
  const intents = []
  const notifications = []
  const loader = sourceLoader({
    "@/lib/auth": { getSession: async () => null },
    "@/lib/checkout-idempotency": { idempotentCheckout: async (_request, _userId, _scope, work) => work() },
    "@/lib/rate-limit": {
      checkRateLimit: async () => limited ? { success: false, retryAfter: 30 } : { success: true },
      RATE_LIMITS: { ORDERS: { message: "Too many orders" } },
    },
    "@/lib/checkout-payment": {
      CheckoutQuoteSchema: sourceLoader().load("lib/checkout-payment.ts").CheckoutQuoteSchema,
      quoteCheckout: async () => quote,
      createCheckoutIntent: async (...args) => { intents.push(args); return "fixture-request-token" },
    },
    "@/lib/order-id": { generateOrderId: async () => "SARAECOM-555001" },
    "@/lib/store-payment": {
      STORE_PAYMENT_REQUEST_TTL_MS: 86400000,
      loadPaymentStore: async id => loaded && id === loaded.id ? loaded : null,
      getStorePaymentWhatsAppSettings: async () => ({
        notifyStoreManager: true, storeManagers: {}, platformManagers: [{ name: "Ops", phone: "9000000001" }],
      }),
      notifyStoreOfPaymentRequest: async (...args) => { notifications.push(args); return { whatsapp: true, email: true, managers: 1 } },
    },
    "@/lib/store-stock": {
      itemCodesFor: async ids => new Map(ids.map(id => [id, `SKU-${id}`])),
      storesHoldingStock: async () => new Set(stocked ? [storeId] : []),
    },
  }, { env })
  return { route: loader.load("app/api/payment/store-request/route.ts"), intents, notifications }
}

test("notification configuration reports missing names without exposing credentials", () => {
  const absent = sourceLoader().load("lib/store-payment.ts").getStorePaymentNotificationConfiguration()
  assert.equal(absent.whatsapp, false); assert.equal(absent.email, false)
  for (const name of ["ASKEVA_API_KEY", "STORE_ORDER_WHATSAPP_TEMPLATE", "PLATFORM_MANAGER_WHATSAPP_TEMPLATE", "CUSTOMER_ORDER_CONFIRMED_WHATSAPP_TEMPLATE", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) assert.ok(absent.missing.includes(name))
  const complete = sourceLoader({}, { env: {
    ASKEVA_API_KEY: "synthetic-private-key", ASKEVA_API_URL: "https://provider.invalid",
    STORE_ORDER_WHATSAPP_TEMPLATE: "store_approved", PLATFORM_MANAGER_WHATSAPP_TEMPLATE: "manager_approved",
    CUSTOMER_ORDER_CONFIRMED_WHATSAPP_TEMPLATE: "customer_approved", SMTP_HOST: "mail.invalid",
    SMTP_USER: "synthetic-user", SMTP_PASS: "synthetic-private-password",
  } }).load("lib/store-payment.ts").getStorePaymentNotificationConfiguration()
  assert.deepEqual(JSON.parse(JSON.stringify(complete)), { whatsapp: true, email: true, missing: [] })
  for (const secret of ["synthetic-private-key", "synthetic-private-password", "synthetic-user", "provider.invalid"]) assert.equal(JSON.stringify(complete).includes(secret), false)
})

test("a store WhatsApp exception does not prevent platform-manager and email notifications", async () => {
  const calls = [], mails = []
  const loader = sourceLoader({
    "@/lib/whatsapp-template": { sendWhatsAppTemplate: async phone => {
      calls.push(phone)
      if (phone === store.phone) throw new Error("Synthetic provider failure")
      return { success: true }
    } },
    "@/lib/email": { sendEmail: async mail => { mails.push(mail); return { success: true } } },
  }, { env: { STORE_ORDER_WHATSAPP_TEMPLATE: "store_approved", PLATFORM_MANAGER_WHATSAPP_TEMPLATE: "manager_approved" },
    context: { console: { ...console, error() {} } } })
  const result = await loader.load("lib/store-payment.ts").notifyStoreOfPaymentRequest(store,
    { orderId: "FIXTURE", customer, delivery: "Store pickup", items: [], total: 10 },
    { notifyStoreManager: true, platformManagers: [{ name: "Ops", phone: "9000000001" }] })
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { whatsapp: false, email: true, managers: 1 })
  assert.deepEqual(calls, [store.phone, "9000000001"]); assert.equal(mails.length, 1)
})

test("email failure returns its channel status without losing an accepted WhatsApp notification", async () => {
  const loader = sourceLoader({
    "@/lib/whatsapp-template": { sendWhatsAppTemplate: async () => ({ success: true }) },
    "@/lib/email": { sendEmail: async () => { throw new Error("Synthetic mail failure") } },
  }, { env: { STORE_ORDER_WHATSAPP_TEMPLATE: "store_approved" }, context: { console: { ...console, error() {} } } })
  const result = await loader.load("lib/store-payment.ts").notifyStoreOfPaymentRequest(store,
    { orderId: "FIXTURE", customer, delivery: "Store pickup", items: [], total: 10 })
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { whatsapp: true, email: false, managers: 0 })
})

test("Pay at Store dialog does not claim the store received a failed notification", () => {
  const Dialog = sourceLoader({ react: { ...React, useEffect() {}, useState: initial => [initial, () => {}] } })
    .load("components/PayAtStore.tsx").PayAtStoreDialog
  const props = { storeName: "Fixture store", orderReference: "FIXTURE", amount: 10, customerPhone: "", submitting: false, onSubmit() {}, onClose() {} }
  const failed = renderToStaticMarkup(React.createElement(Dialog, { ...props, storeNotified: false }))
  assert.ok(failed.includes("We could not notify the store automatically")); assert.ok(failed.includes("Call the store"))
  assert.equal(failed.includes("A store manager will call you"), false)
  const sent = renderToStaticMarkup(React.createElement(Dialog, { ...props, storeNotified: true }))
  assert.ok(sent.includes("was sent to")); assert.ok(sent.includes("A store manager will call you"))
})

test("pay at store request binds a 24h intent to the store and messages it with the order, delivery and price", async () => {
  const fixture = requestLoader()
  const response = await fixture.route.POST(post(requestBody))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.deepEqual({ requestId: data.requestId, requestToken: data.requestToken, store: data.store.name },
    { requestId: "SARAECOM-555001", requestToken: "fixture-request-token", store: "Fixture Store" })
  const [orderId, userId, , method, extra] = fixture.intents[0]
  assert.deepEqual([orderId, userId, method, extra.ttlMs, extra.store.id], ["SARAECOM-555001", null, "store-payment", 86400000, storeId])
  const [notifiedStore, summary] = fixture.notifications[0]
  assert.equal(notifiedStore.id, storeId)
  assert.equal(summary.orderId, "SARAECOM-555001")
  assert.equal(summary.total, 1234)
  assert.match(summary.delivery, /Store pickup at Fixture Store.*1 Fixture Street, Bengaluru/)
  assert.equal(summary.customer.phone, customer.phone)
  assert.deepEqual([...summary.offers], [])
  const recipients = fixture.notifications[0][2]
  assert.deepEqual([recipients.notifyStoreManager, recipients.platformManagers[0].phone], [true, "9000000001"])
})

test("pay at store request lists the coupon and reward discount as offers", async () => {
  const original = { ...quote }
  Object.assign(quote, {
    amount: 1000,
    pricing: { ...quote.pricing, total: 1100, coupon: { code: "FEST10", name: "Festive", discount: 120 } },
  })
  try {
    const fixture = requestLoader()
    assert.equal((await fixture.route.POST(post(requestBody))).status, 200)
    assert.deepEqual([...fixture.notifications[0][1].offers], ["Coupon FEST10 (Festive): -Rs. 120", "Reward points: -Rs. 100"])
  } finally {
    Object.assign(quote, original)
  }
})

test("pay at store request is refused when disabled, rate limited, invalid, for an unknown or unstocked store or a mismatched pickup", async () => {
  const cases = [
    [{ stocked: false }, requestBody, 409],
    [{ env: { PAY_AT_STORE_ENABLED: "false" } }, requestBody, 403],
    [{ limited: true }, requestBody, 429],
    [{}, { ...requestBody, customer: { ...customer, phone: "12345" } }, 400],
    [{}, { ...requestBody, storeId: "" }, 400],
    [{ loaded: null }, requestBody, 404],
    [{ loaded: { ...store, phone: "", email: "" } }, requestBody, 409],
    [{}, { ...requestBody, fulfilment: { method: "pickup", storeId: "another-store" } }, 400],
  ]
  for (const [options, body, status] of cases) {
    const fixture = requestLoader(options)
    const response = await fixture.route.POST(post(body))
    assert.equal(response.status, status, JSON.stringify(options))
    if (status === 409) assert.equal(response.headers.get("Checkout-Retry-Safe"), "true")
    assert.equal(fixture.notifications.length, 0)
    assert.equal(fixture.intents.length, 0)
  }
})

test("store WhatsApp uses the configured template with eight flat parameters and the store email escapes customer text", async () => {
  const sent = []
  const mails = []
  const loader = sourceLoader({
    "@/lib/email": { sendEmail: async mail => { mails.push(mail); return { success: true } } },
  }, {
    env: { ASKEVA_API_KEY: "fixture-key", ASKEVA_API_URL: "https://provider.invalid", STORE_ORDER_WHATSAPP_TEMPLATE: "store_order_v1" },
    fetch: async (_url, init) => {
      sent.push(JSON.parse(init.body))
      return Response.json({ messaging_product: "whatsapp", messages: [{ id: "fixture-message" }] })
    },
  })
  const result = await loader.load("lib/store-payment.ts").notifyStoreOfPaymentRequest(store, {
    orderId: "SARAECOM-555001",
    customer: { name: "<b>Shopper</b>", phone: customer.phone, email: customer.email },
    delivery: "Home delivery:\n1 Fixture\tStreet",
    items: [{ name: "Fixture TV", quantity: 2, price: 1000 }],
    total: 2000,
  })
  assert.deepEqual({ ...result }, { whatsapp: true, email: true, managers: 0 })
  assert.equal(sent[0].to, "919876543210")
  assert.equal(sent[0].template.name, "store_order_v1")
  const params = sent[0].template.components[0].parameters.map(parameter => parameter.text)
  assert.equal(params.length, 8)
  assert.equal(params[0], "SARAECOM-555001")
  assert.equal(params[3], customer.email)
  assert.equal(params[5], "None")
  assert.equal(params[6], "Home delivery: 1 Fixture Street")
  for (const text of params) assert.doesNotMatch(text, /[\n\t]| {5,}/)
  assert.equal(mails[0].to, "store@example.invalid")
  assert.equal(mails[0].html.includes("<b>Shopper</b>"), false)
  assert.ok(mails[0].html.includes("&lt;b&gt;Shopper&lt;/b&gt;"))
})

test("platform managers get their own template with the store name, the store manager can be switched off and numbers are not messaged twice", async () => {
  const sent = []
  const bodies = []
  const loader = sourceLoader({
    "@/lib/email": { sendEmail: async () => ({ success: true }) },
  }, {
    env: {
      ASKEVA_API_KEY: "fixture-key", ASKEVA_API_URL: "https://provider.invalid",
      STORE_ORDER_WHATSAPP_TEMPLATE: "store_order_v1", PLATFORM_MANAGER_WHATSAPP_TEMPLATE: "platform_order_v1",
    },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body)
      sent.push(body.to)
      bodies.push(body)
      return Response.json({ messaging_product: "whatsapp", messages: [{ id: "fixture-message" }] })
    },
  })
  const { notifyStoreOfPaymentRequest } = loader.load("lib/store-payment.ts")
  const summary = { orderId: "SARAECOM-555004", customer, delivery: "Store pickup", items: [], offers: ["Coupon X: -Rs. 5"], total: 10 }
  const managers = [{ name: "Ops", phone: "9000000001" }, { name: "Store dup", phone: store.phone }]
  const both = await notifyStoreOfPaymentRequest(store, summary, { notifyStoreManager: true, platformManagers: managers })
  assert.deepEqual({ whatsapp: both.whatsapp, managers: both.managers }, { whatsapp: true, managers: 1 })
  assert.deepEqual([...sent].sort(), ["919000000001", "919876543210"])
  const toStore = bodies.find(body => body.to === "919876543210").template
  const toManager = bodies.find(body => body.to === "919000000001").template
  assert.deepEqual([toStore.name, toStore.components[0].parameters.length], ["store_order_v1", 8])
  assert.deepEqual([toManager.name, toManager.components[0].parameters.length], ["platform_order_v1", 9])
  assert.equal(toManager.components[0].parameters[1].text, "Fixture Store")
  assert.equal(toManager.components[0].parameters[6].text, "Coupon X: -Rs. 5")
  sent.length = 0
  const managersOnly = await notifyStoreOfPaymentRequest(store, summary, { notifyStoreManager: false, platformManagers: managers })
  assert.deepEqual({ whatsapp: managersOnly.whatsapp, managers: managersOnly.managers }, { whatsapp: false, managers: 2 })
  assert.deepEqual([...sent].sort(), ["919000000001", "919876543210"])
})

test("customer gets the order-confirmed WhatsApp with payment and delivery details, and nothing without a template", async () => {
  const bodies = []
  const load = env => sourceLoader({}, {
    env: { ASKEVA_API_KEY: "fixture-key", ASKEVA_API_URL: "https://provider.invalid", ...env },
    fetch: async (_url, init) => {
      bodies.push(JSON.parse(init.body))
      return Response.json({ messaging_product: "whatsapp", messages: [{ id: "fixture-message" }] })
    },
    context: { console: { ...console, error: () => {} } },
  }).load("lib/store-payment.ts")
  const order = {
    ...pendingOrder(),
    items: [{ name: "Fixture TV", quantity: 1, price: 1234 }],
    customer: { name: "Synthetic Shopper", phone: customer.phone, address: "1 Fixture Street", city: "Bengaluru", zipCode: "560001" },
  }
  assert.equal((await load({}).sendStorePaymentConfirmedWhatsApp(order)).status, "skipped")
  assert.equal(bodies.length, 0)
  const result = await load({ CUSTOMER_ORDER_CONFIRMED_WHATSAPP_TEMPLATE: "order_confirmed_v1" }).sendStorePaymentConfirmedWhatsApp(order)
  assert.equal(result.status, "sent")
  assert.equal(bodies[0].to, `91${customer.phone}`)
  assert.equal(bodies[0].template.name, "order_confirmed_v1")
  const params = bodies[0].template.components[0].parameters.map(parameter => parameter.text)
  assert.deepEqual(params, [
    "Synthetic Shopper", "SARAECOM-555003", "Fixture TV x1 (Rs. 1,234)", "Rs. 1,234",
    "PhonePe, txn T2410231234, at Fixture Store", "Delivery to 1 Fixture Street, Bengaluru, 560001",
  ])
})

test("WhatsApp recipient settings normalise numbers, drop duplicate managers and reject bad input", () => {
  const { StorePaymentWhatsAppSettingsSchema } = sourceLoader().load("types/store-payment.ts")
  const parsed = StorePaymentWhatsAppSettingsSchema.parse({
    notifyStoreManager: true,
    storeManagers: { [storeId]: "+91 98765-43210" },
    platformManagers: [{ name: "Ops", phone: "09000000001" }, { name: "Ops again", phone: "9000000001" }],
  })
  assert.equal(parsed.storeManagers[storeId], "9876543210")
  assert.deepEqual(parsed.platformManagers.map(manager => manager.phone), ["9000000001"])
  for (const bad of [
    { storeManagers: { [storeId]: "12345" } },
    { storeManagers: { "not-a-store": "9876543210" } },
    { platformManagers: [{ name: "", phone: "9000000001" }] },
    { platformManagers: [{ name: "Ops", phone: "5000000001" }] },
    { unexpected: true },
  ]) assert.equal(StorePaymentWhatsAppSettingsSchema.safeParse(bad).success, false, JSON.stringify(bad))
})

test("the WhatsApp recipients admin route requires a full admin and saves validated settings", async () => {
  const writes = []
  const load = allowed => sourceLoader({
    "@/lib/auth": {
      requireFullAdmin: async () => allowed
        ? { ok: true, user: { id: "admin-1" } } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) },
    },
    "@/lib/db-service": {
      getCollection: async name => ({
        findOne: async () => null,
        find: () => ({ sort: () => ({ toArray: async () => name === "store_locations" ? [{ _id: new ObjectId(storeId), shopName: "Fixture Store", city: "Bengaluru", mobileNo: "9876543210" }] : [] }) }),
        updateOne: async (filter, update) => { writes.push({ name, filter, update }); return { acknowledged: true } },
      }),
    },
  }).load("app/api/admin/store-payment-whatsapp/route.ts")
  const put = body => new NextRequest("https://fixture.invalid/api/admin/store-payment-whatsapp", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  assert.equal((await load(false).GET()).status, 403)
  assert.equal((await load(false).PUT(put({}))).status, 403)
  const route = load(true)
  const listed = await (await route.GET()).json()
  assert.deepEqual([listed.stores[0].name, listed.stores[0].listedPhone, listed.settings.notifyStoreManager], ["Fixture Store", "9876543210", true])
  assert.equal((await route.PUT(put({ platformManagers: [{ name: "Ops", phone: "123" }] }))).status, 400)
  assert.equal(writes.length, 0)
  const response = await route.PUT(put({ notifyStoreManager: false, platformManagers: [{ name: "Ops", phone: "9000000001" }] }))
  assert.equal(response.status, 200)
  assert.deepEqual([writes[0].name, writes[0].filter._id, writes[0].update.$set.notifyStoreManager, writes[0].update.$set.updatedBy],
    ["store_payment_settings", "whatsapp", false, "admin-1"])
})

test("pay at store lists every active store live from store locations and flags those that cannot receive orders", async () => {
  const withPhone = new ObjectId()
  const withOverride = new ObjectId()
  const unreachable = new ObjectId()
  let filter = null
  const load = env => sourceLoader({
    "@/lib/db-service": {
      getCollection: async name => name === "store_locations" ? {
        find: query => { filter = query; return { sort: () => ({ toArray: async () => [
          { _id: withPhone, shopName: "Jayanagar", locationDescription: "4th Block, Jayanagar, Bengaluru - 560011", mobileNo: "9876543210", shopTiming: "10 AM - 9 PM", googleMapLocation: "https://maps.google.com/?q=12.93,77.58" },
          { _id: withOverride, shopName: "Hubballi", locationDescription: "Station Road, Hubballi - 580020", mobileNo: "" },
          { _id: unreachable, shopName: "No Contact", locationDescription: "Somewhere" },
        ] }) } },
      } : { findOne: async () => ({ storeManagers: { [withOverride.toString()]: "9000000002" } }) },
    },
  }, { env }).load("app/api/payment/stores/route.ts")
  const response = await load({}).GET()
  assert.equal(response.headers.get("cache-control"), "no-store")
  const { stores } = await response.json()
  assert.equal(filter.isActive, true)
  assert.deepEqual(JSON.parse(JSON.stringify(filter.$or)), [{ locationType: "store" }, { locationType: { $exists: false } }, { locationType: null }])
  assert.deepEqual(stores.map(store => [store.name, store.acceptsPayAtStore]), [["Jayanagar", true], ["Hubballi", true], ["No Contact", false]])
  assert.deepEqual([stores[0].city, stores[0].pincode, stores[0].latitude, stores[0].hours], ["Bengaluru", "560011", 12.93, "10 AM - 9 PM"])
  assert.equal(stores[1].city, "Hubballi", "stores outside the delivery region are still offered")
  assert.deepEqual((await (await load({ PAY_AT_STORE_ENABLED: "false" }).GET()).json()).stores, [])
})

test("checkout shows the product title, not the marketing description that follows it", () => {
  const { shortProductTitle } = sourceLoader().load("utils/cleanProductName.ts")
  assert.equal(shortProductTitle("Samsung Galaxy M35 5G (Moonlight Blue, 6GB RAM, 128GB) | Corning Gorilla Glass Victus+ | 6000mAh"),
    "Samsung Galaxy M35 5G (Moonlight Blue, 6GB RAM, 128GB)")
  assert.equal(shortProductTitle("Amazon.in: Bosch Series 4 Washing Machine - 8 kg front load with steam"), "Bosch Series 4 Washing Machine")
  assert.equal(shortProductTitle("LG 55 inch QNED TV. Immersive picture quality for every room"), "LG 55 inch QNED TV")
  const long = shortProductTitle("Immersive 65-inch QNED 4K Ultra HD Display Step into a world of unparalleled home entertainment with the LG QNED82T Smart TV ".repeat(5))
  assert.ok(long.length <= 81 && long.endsWith("…"), long)
  assert.equal(shortProductTitle(""), "")
})

test("store notification still emails the store when no WhatsApp template is configured", async () => {
  const mails = []
  const loader = sourceLoader({
    "@/lib/email": { sendEmail: async mail => { mails.push(mail); return { success: true } } },
  }, { context: { console: { ...console, error: () => {} } } })
  const result = await loader.load("lib/store-payment.ts").notifyStoreOfPaymentRequest(store, {
    orderId: "SARAECOM-555002", customer, delivery: "Store pickup", items: [], total: 10,
  })
  assert.deepEqual({ ...result }, { whatsapp: false, email: true, managers: 0 })
  assert.equal(mails.length, 1)
})

const admin = { id: new ObjectId().toString(), role: "admin", name: "Fixture Admin", email: "admin@example.invalid" }
const pendingOrder = () => ({
  _id: new ObjectId(), orderId: "SARAECOM-555003", status: "pending", total: 1234, userId: null, items: [],
  customer: { name: "Synthetic Shopper", email: "shopper@example.invalid", phone: customer.phone },
  paymentMethod: "store-payment",
  paymentDetails: { method: "store-payment", status: "pending" },
  storePayment: {
    status: "confirmation_pending", storeId, storeName: "Fixture Store", storeEmail: "store@example.invalid",
    platform: "phonepe", transactionId: "T2410231234", submittedAt: new Date(),
  },
})

function approvalLoader(order, account = admin) {
  const updates = []
  const mails = []
  const notified = []
  const collection = {
    findOne: async () => order,
    findOneAndUpdate: async (filter, mutation) => {
      updates.push({ filter, mutation })
      if (order.status !== filter.status || order.storePayment?.status !== filter["storePayment.status"]) return null
      const after = structuredClone(order)
      for (const [key, value] of Object.entries(mutation.$set)) {
        const path = key.split(".")
        path.slice(0, -1).reduce((target, name) => target[name], after)[path.at(-1)] = value
      }
      return after
    },
  }
  const loader = sourceLoader({
    "@/lib/auth": {
      getSession: async () => account ? { user: account } : null,
      requireAdmin: async () => account?.role === "admin"
        ? { ok: true, userId: account.id } : { ok: false, response: Response.json({ error: "Admin access required" }, { status: 401 }) },
    },
    "@/lib/db-service": {
      getCollection: async () => collection,
      normalizeId: value => { const { _id, ...rest } = value; return { ...rest, id: String(_id) } },
    },
    "@/lib/email": { sendEmail: async mail => { mails.push(mail); return { success: true } } },
    "@/lib/emailTemplates": { getEmailTemplate: () => "<p>Fixture</p>", getEmailSubject: () => "Processing", getEmailTemplateId: () => "processing" },
    "@/lib/order-notifications": { notifyAdminOrder: async (...args) => { notified.push(args); return { status: "sent" } } },
    "@/lib/push": { notifyOrderStatus: async () => {} },
  })
  return { route: loader.load("app/api/orders/[id]/approve-store-payment/route.ts"), updates, mails, notified }
}

test("approving a store payment records the approver, moves the order to processing and emails customer, admins and store staff", async () => {
  const order = pendingOrder()
  const fixture = approvalLoader(order)
  const response = await fixture.route.POST(post({}, `/api/orders/${order._id}/approve-store-payment`), { params: Promise.resolve({ id: String(order._id) }) })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.status, "processing")
  assert.equal(data.storePayment.status, "approved")
  assert.deepEqual(data.storePayment.approvedBy, { id: admin.id, name: admin.name, email: admin.email })
  assert.equal(data.paymentVerification.verified, true)
  assert.equal(fixture.updates[0].mutation.$push.timeline.$each[0].status, "Processing")
  assert.deepEqual(fixture.mails.map(mail => mail.to).sort(), ["shopper@example.invalid", "store@example.invalid"])
  assert.ok(fixture.mails.find(mail => mail.to === "store@example.invalid").html.includes("Fixture Admin"))
  assert.equal(fixture.notified[0][2], "confirmed")
})

test("store payment approval is refused without an admin, or when nothing awaits confirmation", async () => {
  const order = pendingOrder()
  const ctx = { params: Promise.resolve({ id: String(order._id) }) }
  assert.equal((await approvalLoader(order, null).route.POST(post({}), ctx)).status, 401)
  for (const changed of [{ status: "processing" }, { storePayment: { ...order.storePayment, status: "approved" } }, { storePayment: undefined }]) {
    const fixture = approvalLoader({ ...order, ...changed })
    assert.equal((await fixture.route.POST(post({}), ctx)).status, 409)
    assert.equal(fixture.updates.length, 0)
    assert.equal(fixture.mails.length, 0)
  }
})

test("the generic order update cannot progress a store payment that has not been approved", async () => {
  const order = pendingOrder()
  const loader = sourceLoader({
    "@/lib/auth": {
      getSession: async () => ({ user: admin }),
      requireAdmin: async () => ({ ok: true, userId: admin.id }),
    },
    "@/lib/db-service": {
      createObjectId: value => new ObjectId(value),
      normalizeId: value => ({ ...value, id: String(value._id) }),
      getCollection: async () => ({
        findOne: async () => order,
        findOneAndUpdate: async (_filter, mutation) => ({ ...order, ...mutation.$set }),
      }),
    },
    "@/lib/customer-profile": { EARNING_STATUSES: [], rebuildCustomerProfile: async () => {}, recordEvent: async () => {} },
    "@/lib/push": { notifyOrderStatus: async () => {} },
    "@/lib/loyalty": { awardPointsForOrder: async () => {}, reverseOrderPoints: async () => {} },
    "@/lib/order-notifications": { notifyAdminOrder: async () => ({ status: "sent" }) },
    "@/lib/email": { sendEmail: async () => ({ success: true }) },
    "@/lib/emailTemplates": { getEmailTemplate: () => "", getEmailSubject: () => "", getEmailTemplateId: () => "" },
  })
  const route = loader.load("app/api/orders/[id]/route.ts")
  const ctx = { params: Promise.resolve({ id: String(order._id) }) }
  const put = body => new NextRequest(`https://fixture.invalid/api/orders/${order._id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  for (const status of ["processing", "confirmed", "shipped", "delivered"]) {
    assert.equal((await route.PUT(put({ status, trackingNumber: "TRK1" }), ctx)).status, 409, status)
  }
  assert.equal((await route.PUT(put({ status: "cancelled" }), ctx)).status, 200)
})
