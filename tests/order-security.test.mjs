import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"

const id = new ObjectId()
const staffId = new ObjectId()
const staff = { id: staffId.toString(), role: "user", email: "staff@example.invalid", dashboardAccess: true, allowedPages: ["/admin/orders"] }
const order = {
  _id: id, orderId: "SARAECOM-987654", userId: "owner", status: "pending", total: 100,
  fulfilment: { storeId: "store-b" }, customer: { name: "Synthetic", email: "customer@example.invalid" },
  items: [], licenseKey: "synthetic-private-license", guestAccessTokenHash: "synthetic-private-hash",
}
const req = (method = "GET", body, path = `/api/orders/${id}`) => new NextRequest(`https://fixture.invalid${path}`, {
  method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
})
const ctx = { params: Promise.resolve({ id: id.toString() }) }

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$and") return value.every(part => matches(document, part))
    if (key === "$or") return value.some(part => matches(document, part))
    const actual = key.split(".").reduce((result, name) => result?.[name], document)
    if (value && typeof value === "object" && !(value instanceof ObjectId)) {
      if ("$in" in value) return value.$in.includes(actual)
      if ("$exists" in value) return (actual !== undefined) === value.$exists
    }
    return String(actual) === String(value)
  })
}

function securityLoader(account = staff, storeAccess = "selected", storeIds = ["store-a"], source = "orders", storedOrder = order) {
  const writes = []
  let fulfilled = 0
  const collection = {
    findOne: async filter => matches(storedOrder, filter) ? storedOrder : null,
    findOneAndUpdate: async (filter, mutation) => {
      writes.push(filter)
      return matches(storedOrder, filter) ? { ...storedOrder, ...mutation.$set } : null
    },
    deleteOne: async filter => {
      writes.push(filter)
      return { deletedCount: matches(storedOrder, filter) ? 1 : 0 }
    },
  }
  const loader = sourceLoader({
    "@/lib/auth": {
      getSession: async () => account ? { user: account } : null,
      requireAdmin: async () => account?.role === "admin" || account?.dashboardAccess
        ? { ok: true, userId: account.id } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 401 }) },
    },
    "@/lib/db-service": {
      createObjectId: value => new ObjectId(value),
      normalizeId: value => ({ ...value, id: value._id.toString() }),
      getCollection: async name => name === "users"
        ? { findOne: async filter => {
          assert.equal(String(filter._id), staff.id)
          return { _id: staffId, ...staff, storeAccess, storeIds }
        } } : name === source ? collection : { findOne: async () => null, deleteOne: async () => ({ deletedCount: 0 }) },
    },
    "@/lib/customer-profile": { EARNING_STATUSES: [], rebuildCustomerProfile: async () => {}, recordEvent: async () => {} },
    "@/lib/push": { notifyOrderStatus: async () => {} },
    "@/lib/loyalty": { awardPointsForOrder: async () => {}, reverseOrderPoints: async () => {} },
    "@/lib/order-notifications": { notifyAdminOrder: async () => ({ status: "sent" }) },
    "@/lib/software-fulfillment": { fulfillSoftwareOrder: async (_id, scope) => {
      assert.deepEqual(scope["fulfilment.storeId"]?.$in, ["store-b"])
      fulfilled++; return {}
    }, SoftwareFulfillmentError: class extends Error {} },
    "@/lib/emailTemplates": { getEmailTemplate: () => "", getEmailSubject: () => "", getEmailTemplateId: () => "" },
  })
  return { loader, writes, fulfilled: () => fulfilled }
}

for (const source of ["orders", "partner_orders"]) {
  for (const method of ["GET", "PUT", "DELETE"]) {
    test(`${source} ${method} conceals a foreign-store order and refuses mutation`, async () => {
      const fixture = securityLoader(staff, "selected", ["store-a"], source)
      const result = await fixture.loader.load("app/api/orders/[id]/route.ts")[method](req(method, method === "PUT" ? { status: "confirmed" } : undefined), ctx)
      assert.equal(result.status, 404)
      const body = await result.text()
      for (const secret of [order.customer.email, order.licenseKey, order.orderId, order.guestAccessTokenHash]) assert.equal(body.includes(secret), false)
      for (const filter of fixture.writes) assert.equal(matches(order, filter), false)
    })
  }
}

for (const access of ["none", "selected"]) {
  test(`invoice and license allocation fail closed for ${access} store access`, async () => {
    const fixture = securityLoader(staff, access, [])
    const invoice = await fixture.loader.load("app/api/orders/[id]/invoice/route.ts").GET(req(), ctx)
    assert.equal(invoice.status, 404)
    const license = await fixture.loader.load("app/api/orders/[id]/assign-license/route.ts").POST(req("POST"), ctx)
    assert.equal(license.status, 404)
    assert.equal(fixture.fulfilled(), 0)
  })
}

test("foreign-store invoice is concealed even when staff has a nonempty permitted store list", async () => {
  const fixture = securityLoader()
  assert.equal((await fixture.loader.load("app/api/orders/[id]/invoice/route.ts").GET(req(), ctx)).status, 404)
})

test("permitted store mutations retain scoped database predicates and omit guest hash", async () => {
  for (const method of ["PUT", "DELETE"]) {
    const fixture = securityLoader(staff, "selected", ["store-b"])
    const response = await fixture.loader.load("app/api/orders/[id]/route.ts")[method](
      req(method, method === "PUT" ? { status: "confirmed" } : undefined), ctx,
    )
    assert.equal(response.status, 200)
    assert.equal((await response.text()).includes(order.guestAccessTokenHash), false)
    assert.equal(fixture.writes.length, 1)
    assert.deepEqual(fixture.writes[0]["fulfilment.storeId"].$in, ["store-b"])
  }
  const fixture = securityLoader(staff, "selected", ["store-b"])
  assert.equal((await fixture.loader.load("app/api/orders/[id]/assign-license/route.ts").POST(req("POST"), ctx)).status, 200)
  assert.equal(fixture.fulfilled(), 1)
})

test("selected-store staff cannot read unassigned delivery orders", async () => {
  const fixture = securityLoader(staff, "selected", ["store-a"], "orders", { ...order, fulfilment: { method: "delivery" } })
  assert.equal((await fixture.loader.load("app/api/orders/[id]/route.ts").GET(req(), ctx)).status, 404)
})

test("valid guest capability retains detail and invoice access; wrong token stays concealed", async () => {
  const guest = sourceLoader().load("lib/guest-order.ts")
  const token = guest.createGuestAccessToken()
  const fixture = securityLoader(null, "none", [], "orders", {
    ...order, userId: null, guestAccessTokenHash: guest.hashGuestAccessToken(token),
  })
  for (const route of ["app/api/orders/[id]/route.ts", "app/api/orders/[id]/invoice/route.ts"]) {
    const handler = fixture.loader.load(route).GET
    assert.equal((await handler(req("GET", undefined, `/api/orders/${id}?token=${token}`), ctx)).status, 200)
    assert.equal((await handler(req("GET", undefined, `/api/orders/${id}?token=invalid`), ctx)).status, 404)
  }
})

for (const [label, account, access, ids] of [
  ["full admin", { ...staff, role: "admin" }, "none", []],
  ["superadmin", { ...staff, role: "superadmin" }, "none", []],
  ["permitted store staff", staff, "selected", ["store-b"]],
  ["all-store staff", staff, "all", []],
  ["customer owner", { id: "owner", role: "user" }, "none", []],
]) {
  test(`${label} retains order detail access without exposing guest hash`, async () => {
    const result = await securityLoader(account, access, ids).loader.load("app/api/orders/[id]/route.ts").GET(req(), ctx)
    assert.equal(result.status, 200)
    assert.match(result.headers.get("cache-control"), /no-store/)
    assert.equal((await result.text()).includes(order.guestAccessTokenHash), false)
  })
}

test("dashboard flag without orders entitlement does not confer cross-customer access", async () => {
  const result = await securityLoader({ ...staff, allowedPages: ["/admin/products"] }, "all")
    .loader.load("app/api/orders/[id]/route.ts").GET(req(), ctx)
  assert.equal(result.status, 404)
})

test("anonymous and unrelated customer requests do not disclose order data", async () => {
  for (const account of [null, { id: "other", role: "user" }]) {
    const response = await securityLoader(account).loader.load("app/api/orders/[id]/route.ts").GET(req(), ctx)
    assert.equal(response.status, account ? 404 : 401)
  }
})

test("bulk-update cannot bypass a denied store scope by overriding the order id filter", async () => {
  const fixture = securityLoader(staff, "none")
  const response = await fixture.loader.load("app/api/orders/bulk-update/route.ts").POST(req("POST", {
    rows: [{ orderId: id.toString(), status: "processing" }],
  }))
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.success.length, 0)
  assert.equal(data.failed.length, 1)
  assert.equal(fixture.writes.length, 0)
})

function notificationLoader({ enabled = true, email = "notify@example.invalid", status = "confirmed", paymentVerified = false, rejected = false, duplicateRecipient = true, revokedUsers = [], account = { ...staff, role: "admin" } } = {}) {
  let claim
  let settings = { enabled, email }
  const mails = []
  const updates = []
  const fixtureOrder = { ...order, status, userId: null, paymentVerification: { verified: paymentVerified }, paymentDetails: { signature: "synthetic-payment-proof" } }
  const employees = [
    { email: "foreign@example.invalid", storeAccess: "selected", storeIds: ["store-a"] },
    { email: "local@example.invalid", storeAccess: "selected", storeIds: ["store-b"] },
    { email: "all@example.invalid", storeAccess: "all" },
    { email: "none@example.invalid", storeAccess: "none" },
    ...(duplicateRecipient ? [{ email: email.toUpperCase(), storeAccess: "all" }] : []),
  ]
  const loader = sourceLoader({
    "@/lib/auth": {
      requireFullAdmin: async () => account && ["admin", "superadmin"].includes(account.role)
        ? { ok: true, user: account } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: account ? 403 : 401 }) },
    },
    "@/lib/db-service": { getCollection: async name => {
      if (name === "order_notification_settings") return {
        findOne: async () => settings,
        updateOne: async (filter, mutation) => {
          assert.equal(filter._id, "confirmed-orders")
          settings = mutation.$set
          return { acknowledged: true }
        },
      }
      if (name === "settings") return { findOne: async () => ({ storeEmail: "owner@example.invalid" }) }
      if (name === "employees") return { find: () => ({ toArray: async () => employees }) }
      if (name === "users") return { findOne: async ({ email }) => {
        const employee = employees.find(employee => employee.email.toLowerCase() === email)
        return employee ? { _id: staffId, role: "user", dashboardAccess: true, allowedPages: ["/admin/orders"], ...employee,
          ...(revokedUsers.includes(email) ? { status: "inactive" } : {}),
        } : null
      } }
      if (name === "orders") return {
        findOne: async () => fixtureOrder,
        updateOne: async (filter, mutation) => {
          updates.push(mutation)
          if (filter["adminNotifications.confirmed"]) {
            if (claim) return { modifiedCount: 0 }
            claim = true
          }
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
        },
      }
      throw new Error(`Unexpected collection ${name}`)
    } },
    "@/lib/email": { sendEmail: async message => {
      mails.push(message)
      return { success: !rejected }
    } },
  })
  return { loader, mails, updates, settings: () => settings }
}

test("confirmed email claim deduplicates concurrent callbacks and strips customer/payment/license secrets", async () => {
  const fixture = notificationLoader()
  const service = fixture.loader.load("lib/order-notifications.ts")
  const results = await Promise.all([service.notifyAdminOrder(id), service.notifyAdminOrder(id), service.notifyAdminOrder(id)])
  assert.equal(results.filter(result => result.status === "sent").length, 1)
  assert.equal(results.filter(result => result.status === "already_claimed").length, 2)
  assert.deepEqual(fixture.mails.map(mail => mail.to).sort(), ["all@example.invalid", "local@example.invalid", "notify@example.invalid", "owner@example.invalid"])
  for (const mail of fixture.mails) {
    for (const secret of [order.customer.email, order.licenseKey, order.guestAccessTokenHash, "synthetic-payment-proof"]) assert.equal(mail.html.includes(secret), false)
  }
  assert.equal(fixture.updates.at(-1).$set["adminNotifications.confirmed"].status, "sent")
})

test("pending and review orders do not send confirmed notifications", async () => {
  for (const status of ["pending", "payment_review", "cancelled"]) {
    const fixture = notificationLoader({ status })
    assert.equal((await fixture.loader.load("lib/order-notifications.ts").notifyAdminOrder(id)).status, "skipped")
    assert.equal(fixture.mails.length, 0)
  }
})

test("disabling the additional recipient preserves existing permitted store and manager copies", async () => {
  const fixture = notificationLoader({ enabled: false, duplicateRecipient: false })
  assert.equal((await fixture.loader.load("lib/order-notifications.ts").notifyAdminOrder(id)).status, "sent")
  assert.deepEqual(fixture.mails.map(mail => mail.to).sort(), ["all@example.invalid", "local@example.invalid", "owner@example.invalid"])
})

test("stale employee records cannot email a deactivated linked account", async () => {
  const fixture = notificationLoader({ revokedUsers: ["all@example.invalid"] })
  assert.equal((await fixture.loader.load("lib/order-notifications.ts").notifyAdminOrder(id)).status, "sent")
  assert.equal(fixture.mails.some(mail => mail.to === "all@example.invalid"), false)
})

test("paid software orders retain confirmation emails after immediate delivery, but unpaid advanced statuses do not", async () => {
  for (const paid of [true, false]) {
    const fixture = notificationLoader({ status: "delivered", paymentVerified: paid })
    assert.equal((await fixture.loader.load("lib/order-notifications.ts").notifyAdminOrder(id)).status, paid ? "sent" : "skipped")
    assert.equal(fixture.mails.length > 0, paid)
  }
})

test("notification database outage is explicitly logged without throwing after a committed order", async () => {
  const errors = []
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => { throw new Error("Synthetic database outage") } },
  }, { context: { console: { ...console, error: (...args) => errors.push(args) } } })
  assert.equal((await loader.load("lib/order-notifications.ts").notifyAdminOrder(id)).status, "error")
  assert.equal(errors.length, 1)
  assert.match(errors[0][0], /operator attention/)
})

test("notification delivery failure persists an explicit failed result without resending on replay", async () => {
  const fixture = notificationLoader({ rejected: true })
  const service = fixture.loader.load("lib/order-notifications.ts")
  assert.equal((await service.notifyAdminOrder(id)).status, "failed")
  const count = fixture.mails.length
  assert.equal((await service.notifyAdminOrder(id)).status, "already_claimed")
  assert.equal(fixture.mails.length, count)
  assert.equal(fixture.updates.find(update => update.$set["adminNotifications.confirmed"].status === "failed").$set["adminNotifications.confirmed"].failed, count)
})

test("notification settings remain private, validated, normalized and persistently saved", async () => {
  const fixture = notificationLoader()
  const route = fixture.loader.load("app/api/admin/order-notifications/route.ts")
  assert.match((await route.GET()).headers.get("cache-control"), /no-store/)
  for (const input of [
    { enabled: true, email: "" }, { enabled: true, email: "bad\r\nBcc: leak@example.invalid" },
    { enabled: true, email: "correct@example.invalid", storeAccess: "all" },
  ]) assert.equal((await route.PUT(req("PUT", input))).status, 400)
  const saved = await route.PUT(req("PUT", { enabled: true, email: "RECIPIENT@example.invalid" }))
  assert.equal(saved.status, 200)
  assert.equal(fixture.settings().email, "recipient@example.invalid")
  assert.equal(fixture.settings().updatedBy, staff.id)
  assert.deepEqual(await (await route.GET()).json(), { enabled: true, email: "recipient@example.invalid", additionalEmails: [] })
  const many = await route.PUT(req("PUT", {
    enabled: true, email: "recipient@example.invalid",
    additionalEmails: ["SECOND@example.invalid", "second@example.invalid", "recipient@example.invalid"],
  }))
  assert.equal(many.status, 200)
  assert.deepEqual([...fixture.settings().additionalEmails], ["second@example.invalid"])
  assert.equal((await route.PUT(req("PUT", { enabled: true, email: "a@example.invalid", additionalEmails: ["bad\r\nBcc: x@example.invalid"] }))).status, 400)
})

test("notification configuration refuses anonymous customers and even orders-enabled staff", async () => {
  for (const account of [null, { id: "customer", role: "user" }, staff]) {
    const route = notificationLoader({ account }).loader.load("app/api/admin/order-notifications/route.ts")
    assert.equal((await route.GET()).status, account ? 403 : 401)
    assert.equal((await route.PUT(req("PUT", { enabled: true, email: "attacker@example.invalid" }))).status, account ? 403 : 401)
  }
})
