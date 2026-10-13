import assert from "node:assert/strict"
import crypto from "node:crypto"
import { createRequire } from "node:module"
import { MongoClient, ObjectId } from "mongodb"
import { sourceLoader } from "../tests/source-loader.mjs"

const require = createRequire(import.meta.url)
require("@next/env").loadEnvConfig(process.cwd())
const database = process.argv[2]
if (!database?.startsWith("ecom_sara_audit_") || Buffer.byteLength(database) > 38) {
  throw new Error("Usage: node scripts/audit-maintenance.mjs ecom_sara_audit_<identifier>. Live databases are prohibited.")
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required; its value is never printed")
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: 3 })
const run = crypto.randomUUID()
const collections = ["complaints", "products", "categories", "orders", "partner_orders", "counters"]
const owned = Object.fromEntries(collections.map(name => [name, new Set()]))
await client.connect()
const db = client.db(database)
let checks = 0
const check = (label, condition) => {
  assert.ok(condition, label)
  console.log(`PASS: ${label}`)
  checks++
}
const mail = []
let failEmail = false
let failBackfill = false
let failSeed = false
let failComplaint = false
try {
  for (const name of collections) {
    assert.equal(await db.collection(name).countDocuments({}), 0, "Maintenance audit requires initially empty isolated collections")
  }
  const wrap = name => {
    assert.ok(collections.includes(name))
    const target = db.collection(name)
    return new Proxy(target, {
      get(collection, key) {
        if (key === "insertOne") return async (doc, ...args) => {
          doc._id ??= new ObjectId()
          owned[name].add(doc._id)
          return collection.insertOne(doc, ...args)
        }
        if (key === "insertMany") return async (docs, ...args) => {
          for (const doc of docs) { doc._id ??= new ObjectId(); owned[name].add(doc._id) }
          const result = await collection.insertMany(docs, ...args)
          if (failSeed && name === "products") throw new Error("Injected seed insertion failure")
          return result
        }
        if (key === "updateOne") return async (...args) => {
          if (failComplaint && name === "complaints") return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
          const result = await collection.updateOne(...args)
          if (failBackfill && name === "partner_orders") throw new Error("Injected backfill write failure")
          return result
        }
        if (key === "findOneAndUpdate" && name === "counters") return async (...args) => {
          owned.counters.add("order_number")
          return collection.findOneAndUpdate(...args)
        }
        const value = Reflect.get(collection, key)
        return typeof value === "function" ? value.bind(collection) : value
      },
    })
  }
  const loader = sourceLoader({
    "@/lib/auth": {
      requireAdmin: async () => ({ ok: true }),
      checkAdminAuthorization: async () => ({ authorized: true }),
      getSession: async () => ({ user: { id: `audit-${run}` } }),
    },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/api-error": { handleApiError: () => Response.json({ error: "Injected isolated failure" }, { status: 500 }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: { collection: wrap } }) },
    "@/lib/db-service": {
      getCollection: async name => wrap(name),
      COLLECTIONS: { PRODUCTS: "products", CATEGORIES: "categories" },
      createObjectId: id => new ObjectId(id),
      normalizeId: doc => {
        const normalized = { ...doc, id: doc._id.toString() }
        delete normalized._id
        return normalized
      },
    },
    "@/lib/email": { sendEmail: async input => {
      mail.push(input)
      return { success: true, result: { accepted: failEmail ? [] : [input.to] } }
    } },
    "node:fs/promises": { readFile: async filename => {
      assert.ok(filename.endsWith("realistic-laptop-master-data.json"))
      return JSON.stringify([{ "Item No.": `audit-${run}`, "Item Description": "Synthetic maintenance item", "Group Name": `Audit ${run}`, "In Stock": 4 }])
    } },
  }, { env: { NODE_ENV: "development" }, context: { Date } })
  const request = body => new Request("https://fixture.invalid/audit", { method: "POST", body: JSON.stringify(body) })
  const createComplaint = loader.load("app/api/complaints/route.ts").POST
  const body = {
    customerName: "Synthetic <Customer>", email: "fixture@example.invalid", phone: "9876543210",
    orderNumber: "AUDIT-ONLY", complaintType: "enquiry", subject: "Synthetic & issue",
    description: "Synthetic isolated audit complaint", productName: "Synthetic item",
  }
  const created = await createComplaint(request(body))
  const data = await created.json()
  check("complaint creation commits a normalized record and acknowledges accepted escaped mail",
    created.status === 201 && data.notification.status === "sent" && !data.complaint._id &&
    await db.collection("complaints").countDocuments({ _id: new ObjectId(data.complaint.id) }) === 1 &&
    mail[0].html.includes("&lt;Customer&gt;"))
  failEmail = true
  const failedMail = await createComplaint(request(body))
  const failedData = await failedMail.json()
  check("rejected SMTP acceptance preserves the stored complaint with explicit notification failure",
    failedMail.status === 201 && failedData.notification.status === "failed" && await db.collection("complaints").countDocuments({}) === 2)
  failEmail = false
  const updateComplaint = loader.load("app/api/complaints/[id]/route.ts").PUT
  const context = { params: Promise.resolve({ id: data.complaint.id }) }
  const updated = await updateComplaint(request({ status: "processing", adminNote: "Synthetic note" }), context)
  const stored = await db.collection("complaints").findOne({ _id: new ObjectId(data.complaint.id) })
  check("complaint status CAS commits a prepended timeline entry and sends accepted mail",
    updated.status === 200 && stored.status === "processing" && stored.timeline.length === 2 &&
    stored.timeline[0].description === "Synthetic note" && (await updated.json()).notification.status === "sent")
  failComplaint = true
  const beforeMail = mail.length
  const conflicted = await updateComplaint(request({ status: "resolved" }), context)
  check("conflicted complaint status leaves stored status unchanged and sends no notification",
    conflicted.status === 409 && mail.length === beforeMail &&
    (await db.collection("complaints").findOne({ _id: stored._id })).status === "processing")
  failComplaint = false

  const product = { _id: new ObjectId(), id: `legacy-${run}`, name: "Synthetic direct item", source: "manual", stock: 1 }
  const oldSeed = { _id: new ObjectId(), name: "Synthetic prior seed", source: "excel", stock: 1 }
  await wrap("products").insertMany([product, oldSeed])
  const direct = loader.load("app/api/direct-update/[id]/route.ts").PUT
  const directResponse = await direct(request({ stock: 5 }), { params: Promise.resolve({ id: product.id }) })
  check("direct updater resolves a legacy alias and preserves the true native ID in the shared database",
    directResponse.status === 200 && (await directResponse.json()).product.id === product._id.toString() &&
    (await db.collection("products").findOne({ _id: product._id })).stock === 5)
  const seed = loader.load("app/api/seed-database/route.ts").POST
  const preview = await seed(request({}))
  check("catalogue seed previews without replacing existing records",
    preview.status === 200 && (await preview.json()).dryRun === true && await db.collection("products").countDocuments({}) === 2)
  failSeed = true
  const failedSeed = await seed(request({ apply: true }))
  check("seed replacement rolls back category creation, deletion and insertion on a real transaction failure",
    failedSeed.status === 500 && await db.collection("products").countDocuments({}) === 2 &&
    await db.collection("products").countDocuments({ _id: oldSeed._id }) === 1 &&
    await db.collection("categories").countDocuments({}) === 0)
  failSeed = false
  const seeded = await seed(request({ apply: true }))
  check("explicit seed replacement commits exact product counts and preserves non-seed products",
    seeded.status === 200 && (await seeded.json()).products.inserted === 1 &&
    await db.collection("products").countDocuments({}) === 2 &&
    await db.collection("products").countDocuments({ _id: product._id }) === 1)

  const order = { _id: new ObjectId(), createdAt: new Date("2026-01-02") }
  const existing = { _id: new ObjectId(), orderId: "SARAECOM-00900000" }
  const partnerOrder = { _id: `audit-${run}`, createdAt: new Date("2026-01-01") }
  await wrap("orders").insertMany([order, existing])
  await wrap("partner_orders").insertOne(partnerOrder)
  const { backfillOrderIds } = loader.load("scripts/backfill-order-ids.ts")
  const auditDb = { collection: wrap }
  const planned = await backfillOrderIds(client, auditDb)
  check("order backfill previews above existing canonical IDs without creating a counter",
    planned.dryRun && planned.candidates === 2 && planned.minimumNextSequence === 900001 &&
    await db.collection("counters").countDocuments({}) === 0)
  failBackfill = true
  await assert.rejects(backfillOrderIds(client, auditDb, true), /Injected backfill/)
  check("order backfill failure rolls back both counter reservation and order assignment",
    await db.collection("counters").countDocuments({}) === 0 &&
    await db.collection("orders").countDocuments({ orderId: { $exists: false } }) === 1 &&
    await db.collection("partner_orders").countDocuments({ orderId: { $exists: false } }) === 1)
  failBackfill = false
  const results = await Promise.all([backfillOrderIds(client, auditDb, true), backfillOrderIds(client, auditDb, true)]
    .map(promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }))))
  const newOrder = await db.collection("orders").findOne({ _id: order._id })
  const newPartner = await db.collection("partner_orders").findOne({ _id: partnerOrder._id })
  check("concurrent backfills assign a unique chronological pair and never overwrite an existing ID or regress the counter",
    results.some(result => result.ok) && newPartner.orderId === "SARAECOM-00900001" &&
    newOrder.orderId === "SARAECOM-00900002" &&
    (await db.collection("orders").findOne({ _id: existing._id })).orderId === existing.orderId &&
    (await db.collection("counters").findOne({ _id: "order_number" })).seq === 900002)
  console.log(`PASS: ${checks} real isolated maintenance checks; zero live providers`)
} finally {
  for (const name of collections) {
    if (owned[name].size) await db.collection(name).deleteMany({ _id: { $in: [...owned[name]] } })
  }
  await client.close()
  console.log("Own exact isolated maintenance fixtures cleaned")
}
