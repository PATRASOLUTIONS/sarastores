import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import net from "node:net"
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { MongoClient, ObjectId } from "mongodb"

const require = createRequire(import.meta.url)
require("@next/env").loadEnvConfig(process.cwd())
const database = process.argv[2]
assert.match(database || "", /^ecom_sara_audit_[a-z0-9_]+$/)
assert.ok(Buffer.byteLength(database) <= 38)
assert.ok(process.env.MONGODB_URI)
const secret = crypto.randomBytes(32).toString("hex")
Object.assign(process.env, {
  MONGODB_DB: database, DB_NAME: database, NEXT_PUBLIC_SITE_URL: "http://localhost:3012",
  NEXT_PUBLIC_APP_URL: "http://localhost:3012", NEXTAUTH_URL: "http://localhost:3012",
  SMTP_HOST: "127.0.0.1", SMTP_PORT: "1587", SMTP_USER: "audit@example.invalid", SMTP_PASS: secret,
  EMAIL_FROM: "audit@example.invalid", CONTACT_ADMIN_EMAIL: "admin@example.invalid", VENDOR_EMAIL: "vendor@example.invalid",
  RAZORPAY_KEY_ID: `rzp_test_audit_${crypto.randomBytes(8).toString("hex")}`, RAZORPAY_KEY_SECRET: secret,
  AUDIT_PROVIDER_SECRET: secret, SESSION_SECRET: secret, NEXTAUTH_SECRET: secret,
  RECAPTCHA_SECRET_KEY: secret, NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "audit-local-site-key", COOKIE_DOMAIN: "",
  ASKEVA_API_KEY: "", ASKEVA_API_URL: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "",
  NEXT_DIST_DIR: ".next-audit-journey", NEXT_BUILD_CPUS: "2", RATE_LIMIT_BACKEND: "mongodb",
  NEXT_TELEMETRY_DISABLED: "1",
})
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 3 })
await client.connect()
const db = client.db(database)
if (process.argv[3] === "cleanup") {
  assert.ok(await db.collection("settings").findOne({ _auditFixture: "customer-ui-audit-v1" }), "Missing own isolated database marker")
  for (const { name } of await db.listCollections().toArray()) {
    await db.collection(name).deleteMany({})
  }
  await client.close()
  console.log("Own isolated customer-audit records removed:", database)
  process.exit(0)
}
const marker = "customer-ui-audit-v1"
const resume = ["resume", "rebuild"].includes(process.argv[3])
if (resume) {
  assert.ok(await db.collection("settings").findOne({ _auditFixture: marker }), "Missing own isolated database marker")
  assert.equal(await db.collection("users").countDocuments({ email: { $not: /@example\.invalid$/ } }), 0, "Non-synthetic account found")
} else {
  assert.equal((await db.listCollections().toArray()).length, 0, "Audit requires a fresh, empty isolated database")
}
const categoryId = new ObjectId()
if (!resume) {
await db.collection("products").insertMany([1, 2].map((number) => ({
  name: `Audit Fixture Television${number === 2 ? " Two" : ""}`,
  slug: `audit-fixture-television${number === 2 ? "-two" : ""}`, price: number === 1 ? 4999 : 6999,
  mrp: 7999, stock: 30, active: true, type: "hardware", brand: "Audit Fixture", category: "Electronics",
  categoryId: categoryId.toString(), image: "/sara-logo.png", images: ["/sara-logo.png"],
  description: "Synthetic isolated customer journey fixture.", _auditFixture: marker,
})))
await db.collection("categories").insertOne({ _id: categoryId, name: "Electronics", slug: "audit-electronics", active: true, image: "/sara-logo.png", _auditFixture: marker })
await db.collection("brands").insertOne({ name: "Audit Fixture", slug: "audit-fixture", active: true, logo: "/sara-logo.png", _auditFixture: marker })
await db.collection("settings").insertOne({ companyName: "SARA Audit Fixture", shippingFee: 99, freeShippingThreshold: 1000, _auditFixture: marker })
await db.collection("store_locations").insertOne({ shopName: "Audit Fixture Store", city: "Bangalore", locationDescription: "Synthetic fixture", isActive: true, latitude: 12.9716, longitude: 77.5946, pincode: "560001", mobileNo: "0000000000", _auditFixture: marker })
}

const orders = new Map()
const payments = new Map()
const messages = []
const reply = (res, status, data) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)) }
const provider = http.createServer(async (req, res) => {
  try {
    let raw = ""
    for await (const chunk of req) {
      raw += chunk
      if (raw.length > 65536) throw new Error("Audit payload too large")
    }
    const body = raw ? JSON.parse(raw) : {}
    if (req.url === "/audit/status") return reply(res, 200, { database, orders: orders.size, payments: payments.size, messages: messages.length })
    if (req.url === "/audit/messages") return reply(res, 200, messages)
    if (req.url === "/audit/payments" && req.method === "POST") {
      const order = orders.get(body.orderId)
      assert.ok(order)
      const id = `pay_audit${crypto.randomBytes(8).toString("hex")}`
      payments.set(id, { id, entity: "payment", order_id: order.id, amount: order.amount, currency: "INR", status: "captured", captured: true, method: "upi" })
      return reply(res, 200, { razorpay_payment_id: id, razorpay_order_id: order.id,
        razorpay_signature: crypto.createHmac("sha256", secret).update(`${order.id}|${id}`).digest("hex") })
    }
    if (req.headers["x-audit-secret"] !== secret) throw new Error("Invalid audit provider credential")
    if (req.url === "/v1/orders" && req.method === "POST") {
      assert.ok(Number.isSafeInteger(body.amount) && body.amount > 0)
      const order = { ...body, id: `order_audit${crypto.randomBytes(8).toString("hex")}`, entity: "order", status: "created" }
      orders.set(order.id, order)
      return reply(res, 200, order)
    }
    if (req.url === "/v1/offers" && req.method === "GET") {
      return reply(res, 200, { entity: "collection", count: 0, items: [] })
    }
    if (req.url.startsWith("/v1/payments/") && req.method === "GET") {
      const payment = payments.get(req.url.split("/").at(-1))
      return reply(res, payment ? 200 : 404, payment || { error: { description: "Synthetic payment not found" } })
    }
    reply(res, 404, { error: "Unsupported audit provider request" })
  } catch (error) { console.error("Audit provider rejected request:", error.message); reply(res, 400, { error: "Audit provider rejected request" }) }
})
const smtp = net.createServer(socket => {
  socket.write("220 audit.local ESMTP\r\n")
  let buffer = "", data = false, mail = "", recipients = [], auth = 0
  socket.on("data", chunk => {
    buffer += chunk.toString()
    while (buffer.includes("\r\n")) {
      const end = buffer.indexOf("\r\n"), line = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      if (data) {
        if (line !== ".") { mail += line.replace(/^\.\./, ".") + "\r\n"; continue }
        messages.push({ recipients, raw: mail })
        data = false; mail = ""; recipients = []
        socket.write("250 Accepted by isolated audit sink\r\n"); continue
      }
      if (auth) { auth--; socket.write(auth ? "334 UGFzc3dvcmQ6\r\n" : "235 Authenticated\r\n"); continue }
      if (/^(EHLO|HELO)/i.test(line)) socket.write("250-audit.local\r\n250 AUTH PLAIN LOGIN\r\n")
      else if (/^AUTH PLAIN /i.test(line)) socket.write("235 Authenticated\r\n")
      else if (/^AUTH LOGIN/i.test(line)) { auth = 2; socket.write("334 VXNlcm5hbWU6\r\n") }
      else if (/^MAIL FROM:/i.test(line)) socket.write("250 OK\r\n")
      else if (/^RCPT TO:/i.test(line)) {
        const recipient = line.match(/<([^>]+)>/)?.[1]
        if (!recipient?.endsWith("@example.invalid")) socket.write("550 Audit refuses non-synthetic recipients\r\n")
        else { recipients.push(recipient); socket.write("250 OK\r\n") }
      } else if (/^DATA$/i.test(line) && recipients.length) { data = true; socket.write("354 End with dot\r\n") }
      else if (/^QUIT$/i.test(line)) socket.end("221 Bye\r\n")
      else if (/^RSET$/i.test(line)) { recipients = []; socket.write("250 OK\r\n") }
      else socket.write("500 Unsupported command\r\n")
    }
  })
  socket.on("error", error => console.error("Audit SMTP connection:", error.message))
})
await Promise.all([
  new Promise((resolve, reject) => provider.once("error", reject).listen(1588, "127.0.0.1", resolve)),
  new Promise((resolve, reject) => smtp.once("error", reject).listen(1587, "127.0.0.1", resolve)),
])
process.env.NODE_OPTIONS = `--import "${pathToFileURL(path.resolve("scripts\\audit-journey-preload.mjs")).href}"`
let child
const run = args => new Promise((resolve, reject) => {
  child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...args], { env: process.env, stdio: "inherit" })
  child.once("error", reject)
  child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Next command exited ${code}`)))
})
try {
  console.log("Isolated customer audit database and local providers ready:", database)
  if (process.argv[3] === "rebuild" || !fs.existsSync(".next-audit-journey\\BUILD_ID")) await run(["build"])
  await run(["start", "-p", "3012", "-H", "127.0.0.1"])
} finally {
  provider.close(); smtp.close(); await client.close()
}
