import assert from "node:assert/strict"
import fs from "node:fs"
import { createRequire } from "node:module"
import { MongoClient } from "mongodb"

const require = createRequire(import.meta.url)
require("@next/env").loadEnvConfig(process.cwd())
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
assert.match(report.database || "", /^ecom_sara_audit_[a-z0-9_]+$/)
assert.ok(Buffer.byteLength(report.database) <= 38)
assert.match(report.fixtureRunId || "", /^[a-f0-9]{10}$/)
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2 })
await client.connect()
const db = client.db(report.database)
const checks = []
const check = (label, condition) => { assert.ok(condition, label); checks.push({ label, passed: true }); console.log("PASS:", label) }
try {
  assert.ok(await db.collection("settings").findOne({ _auditFixture: "customer-ui-audit-v1" }))
  const email = `customer${report.fixtureRunId}@example.invalid`
  const guestEmail = `guest${report.fixtureRunId}@example.invalid`
  if (report.steps.some(step => step.label.includes("Register synthetic account") && step.passed)) {
    const user = await db.collection("users").findOne({ email })
    check("Browser registration persisted one verified synthetic account", !!user && user.emailVerified === true && await db.collection("users").countDocuments({ email }) === 1)
    check("Browser profile edit persisted the intended name and phone", user.name === "Synthetic Customer Updated" && user.phone === "9000000001")
    check("Browser checkout persisted the saved address", await db.collection("user_addresses").countDocuments({ userId: user._id.toString() }) === 1)
    const orders = await db.collection("orders").find({ "customer.email": email }).toArray()
    check("Exactly one authenticated UI purchase was recorded", orders.length === 1)
    check("Authenticated order uses server catalogue amount and captured payment", orders[0].total === 4999 && orders[0].paymentDetails?.status === "completed")
    check("Checkout failure and cancellation did not create extra customer orders", orders.length === 1 && await db.collection("checkout_intents").countDocuments({ userId: user._id.toString(), status: "consumed" }) === 1)
    const cart = await db.collection("carts").findOne({ userId: user._id.toString() })
    check("Authenticated server cart is empty after the purchase", !cart || cart.items?.length === 0)
    const guestOrders = await db.collection("orders").find({ "customer.email": guestEmail }).toArray()
    check("Exactly one guest COD purchase was persisted", guestOrders.length === 1 && guestOrders[0].total === 6999 && guestOrders[0].paymentMethod === "cash-on-delivery")
    check("Guest order preserves pending payment state", guestOrders[0].paymentDetails?.status === "pending")
  } else {
    check("Contact form stored the synthetic enquiry", await db.collection("contact_inquiries").countDocuments({ email }) === 1)
    check("Complaint form stored the synthetic support request", await db.collection("complaints").countDocuments({ email }) === 1)
    check("Newsletter form stored one synthetic newsletter lead", await db.collection("leads").countDocuments({ email, category: "Newsletter" }) === 1)
  }
  fs.writeFileSync(process.argv[3], JSON.stringify({ database: report.database, fixtureRunId: report.fixtureRunId, checks }, null, 2))
} finally { await client.close() }
