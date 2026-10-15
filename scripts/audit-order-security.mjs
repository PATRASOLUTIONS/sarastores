import assert from "node:assert/strict"
import crypto from "node:crypto"
import { createRequire } from "node:module"
import { MongoClient, ObjectId } from "mongodb"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "../tests/source-loader.mjs"

const require = createRequire(import.meta.url)
require("@next/env").loadEnvConfig(process.cwd())
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required; its value is never printed")
const database = `ecom_sara_audit_orders_${crypto.randomBytes(4).toString("hex")}`
assert.match(database, /^ecom_sara_audit_orders_[a-f0-9]{8}$/)
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000 })
const created = new Map()
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks++ }
const allowed = new Set(["users", "orders", "partner_orders", "employees", "settings", "order_notification_settings"])
const mails = []
let token
async function insert(name, doc) {
  const collection = client.db(database).collection(name)
  const result = await collection.insertOne(doc)
  if (!created.has(name)) created.set(name, [])
  created.get(name).push(result.insertedId)
  return { ...doc, _id: result.insertedId }
}
const request = (id, method = "GET", body, suffix = "") => new NextRequest(`https://fixture.invalid/api/orders/${id}${suffix}`, {
  method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
})
const context = id => ({ params: Promise.resolve({ id: String(id) }) })
try {
  await client.connect()
  const db = client.db(database)
  check((await db.listCollections({}, { nameOnly: true }).toArray()).length === 0, "A new empty isolated database is required")
  const staff = await insert("users", {
    name: "Synthetic store staff", email: "staff@example.invalid", role: "user", sessionVersion: 0,
    dashboardAccess: true, allowedPages: ["/admin/orders"], storeAccess: "selected", storeIds: ["store-a"],
  })
  const admin = await insert("users", { name: "Synthetic admin", email: "admin@example.invalid", role: "admin", sessionVersion: 0 })
  const customer = await insert("users", { name: "Synthetic customer", email: "customer@example.invalid", role: "user", sessionVersion: 0 })
  const loader = sourceLoader({
    "next/headers": {
      headers: async () => new Headers({ "x-sara-request-path": "/api/orders" }),
      cookies: async () => ({ get: () => token ? { value: token } : undefined }),
    },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db, client }) },
    "@/lib/db-service": {
      getCollection: async name => { assert.ok(allowed.has(name), `Unexpected collection: ${name}`); return db.collection(name) },
      getById: async (name, id) => {
        assert.equal(name, "users")
        const doc = await db.collection("users").findOne({ _id: new ObjectId(id) })
        return doc ? { ...doc, id: String(doc._id) } : null
      },
      normalizeId: doc => { const { _id, ...fields } = doc; return { ...fields, id: String(_id) } },
      createObjectId: id => new ObjectId(id),
      getSettingsData: async () => {
        const doc = await db.collection("settings").findOne({})
        const fields = { ...doc }
        delete fields._id
        return fields
      },
    },
    "@/lib/email": { sendEmail: async mail => {
      assert.match(mail.to, /^[^@\s]+@example\.invalid$/)
      mails.push(mail)
      return { success: true }
    } },
    "@/lib/customer-profile": { EARNING_STATUSES: [], rebuildCustomerProfile: async () => {}, recordEvent: async () => {} },
    "@/lib/loyalty": { awardPointsForOrder: async () => {}, reverseOrderPoints: async () => {} },
    "@/lib/push": { notifyOrderStatus: async () => {} },
  })
  const signing = loader.load("lib/session.ts")
  const as = async user => { token = user ? await signing.createSessionToken({
    id: String(user._id), name: user.name, email: user.email, role: user.role,
    sessionVersion: user.sessionVersion,
  }) : undefined }
  const guest = loader.load("lib/guest-order.ts")
  const guestToken = guest.createGuestAccessToken()
  const base = {
    status: "pending", total: 100, items: [], createdAt: new Date(), updatedAt: new Date(),
    customer: { name: "Synthetic customer", email: "customer@example.invalid" },
    licenseKey: "synthetic-license-never-email", guestAccessTokenHash: guest.hashGuestAccessToken(guestToken),
  }
  const foreign = await insert("orders", { ...base, orderId: "SARAECOM-980001", userId: String(customer._id), fulfilment: { storeId: "store-b" } })
  const local = await insert("orders", { ...base, orderId: "SARAECOM-980002", userId: String(customer._id), fulfilment: { storeId: "store-a" } })
  const guestOrder = await insert("orders", { ...base, orderId: "SARAECOM-980003", userId: null, fulfilment: { method: "delivery" } })
  await insert("settings", { storeEmail: "manager@example.invalid" })
  for (const [email, storeIds] of [["staff@example.invalid", ["store-a"]], ["other-store@example.invalid", ["store-b"]]]) {
    await insert("employees", { email, dashboardAccess: true, status: "active", allowedPages: ["/admin/orders"], storeAccess: "selected", storeIds })
    if (email !== staff.email) await insert("users", {
      name: "Synthetic second-store staff", email, role: "user", sessionVersion: 0,
      dashboardAccess: true, status: "active", allowedPages: ["/admin/orders"], storeAccess: "selected", storeIds,
    })
  }
  const detail = loader.load("app/api/orders/[id]/route.ts")
  const invoice = loader.load("app/api/orders/[id]/invoice/route.ts")
  await as(staff)
  for (const method of ["GET", "PUT", "DELETE"]) {
    const response = await detail[method](request(foreign._id, method, method === "PUT" ? { status: "confirmed" } : undefined), context(foreign._id))
    check(response.status === 404, `Foreign-store ${method} must be concealed`)
    check(!(await response.text()).includes(foreign.customer.email), "Denied response cannot leak customer email")
  }
  check((await invoice.GET(request(foreign._id), context(foreign._id))).status === 404, "Foreign invoice must be concealed")
  check((await detail.GET(request(local._id), context(local._id))).status === 200, "Permitted store detail must remain available")
  check((await db.collection("orders").findOne({ _id: foreign._id })).status === "pending", "Denied requests must not mutate the order")
  check(mails.length === 0, "Denied requests must not send email")
  const notificationRoute = loader.load("app/api/admin/order-notifications/route.ts")
  check((await notificationRoute.GET()).status === 403, "Staff cannot read notification recipient")
  await as(customer)
  check((await detail.GET(request(foreign._id), context(foreign._id))).status === 200, "Customer ownership must be preserved")
  await as(null)
  check((await detail.GET(request(guestOrder._id), context(guestOrder._id))).status === 401, "Anonymous without capability must be rejected")
  const capability = await detail.GET(request(guestOrder._id, "GET", undefined, `?token=${guestToken}`), context(guestOrder._id))
  check(capability.status === 200, "Valid guest capability must work")
  check(!(await capability.text()).includes(base.guestAccessTokenHash), "Guest response must not contain capability hash")
  check((await invoice.GET(request(guestOrder._id, "GET", undefined, "?token=wrong"), context(guestOrder._id))).status === 404, "Invalid guest capability must conceal invoice")
  await as(admin)
  const settingResponse = await notificationRoute.PUT(request("", "PUT", { enabled: true, email: "NOTIFY@example.invalid" }))
  check(settingResponse.status === 200, "Full admin must save recipient")
  created.set("order_notification_settings", ["confirmed-orders"])
  check((await db.collection("order_notification_settings").findOne({ _id: "confirmed-orders" })).email === "notify@example.invalid", "Recipient must persist normalized in MongoDB")
  check((await (await notificationRoute.GET()).json()).email === "notify@example.invalid", "Saved settings must reload")
  check(!(await (await loader.load("app/api/settings/route.ts").GET()).text()).includes("notify@example.invalid"), "Public settings must not expose notification recipient")
  const confirmed = await detail.PUT(request(foreign._id, "PUT", { status: "confirmed" }), context(foreign._id))
  check(confirmed.status === 200, "Admin confirmation must succeed")
  check((await db.collection("orders").findOne({ _id: foreign._id })).adminNotifications.confirmed.status === "sent", "Notification state must persist")
  const adminCopies = mails.filter(mail => mail.subject.startsWith("Order confirmed"))
  check(adminCopies.some(mail => mail.to === "notify@example.invalid"), "Configured recipient must get confirmation")
  check(adminCopies.some(mail => mail.to === "other-store@example.invalid"), "Permitted store staff must retain their copy")
  check(!adminCopies.some(mail => mail.to === "staff@example.invalid"), "Foreign-store staff must not get emailed")
  for (const mail of adminCopies) {
    check(!mail.html.includes(base.licenseKey) && !mail.html.includes(base.customer.email) && !mail.html.includes(base.guestAccessTokenHash), "Admin copies must not expose customer/license/capability data")
  }
  const beforeReplay = mails.length
  const notify = loader.load("lib/order-notifications.ts").notifyAdminOrder
  await Promise.all([notify(foreign._id), notify(foreign._id), notify(foreign._id)])
  check(mails.length === beforeReplay, "Concurrent/replayed notification must not send duplicates")
  await db.collection("orders").updateOne({ _id: guestOrder._id }, { $set: { status: "confirmed" } })
  const races = await Promise.all([notify(guestOrder._id), notify(guestOrder._id), notify(guestOrder._id)])
  check(races.filter(result => result.status === "sent").length === 1, "Only one fresh concurrent notification claim may win")
  check(races.filter(result => result.status === "already_claimed").length === 2, "Other concurrent claims must not send")
  check(mails.length === beforeReplay + 2, "Only manager and configured recipient may receive a delivery-order summary")
  await as(staff)
  await db.collection("users").updateOne({ _id: staff._id }, { $set: { storeIds: ["store-b"] } })
  check((await detail.GET(request(foreign._id), context(foreign._id))).status === 200, "New live store permission must take effect")
  check((await detail.GET(request(local._id), context(local._id))).status === 404, "Revoked store permission must take effect despite existing signed token")
  await db.collection("users").updateOne({ _id: staff._id }, { $set: { status: "inactive" } })
  check((await detail.GET(request(foreign._id), context(foreign._id))).status === 401, "Deactivated staff token must fail closed")
  await db.collection("users").updateOne({ email: "other-store@example.invalid" }, { $set: { status: "inactive" } })
  const cancelledAccess = await insert("orders", { ...base, orderId: "SARAECOM-980004", status: "confirmed", fulfilment: { storeId: "store-b" } })
  const beforeInactive = mails.length
  check((await notify(cancelledAccess._id)).status === "sent", "Notification can still reach full-authority recipients")
  check(!mails.slice(beforeInactive).some(mail => mail.to === "other-store@example.invalid"), "Inactive live user must not receive a stale employee notification")
  console.log(`PASS: ${checks} real isolated MongoDB/order/authentication/notification checks; no real payment or email provider calls`)
} finally {
  for (const [name, ids] of created) await client.db(database).collection(name).deleteMany({ _id: { $in: ids } })
  if (created.size) {
    for (const { name } of await client.db(database).listCollections({}, { nameOnly: true }).toArray()) {
      assert.equal(await client.db(database).collection(name).countDocuments({}), 0, "All own synthetic records must be removed")
    }
    console.log("PASS: all synthetic audit records removed")
  }
  await client.close()
}
