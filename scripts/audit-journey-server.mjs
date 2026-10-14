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
import PaytmChecksum from "paytmchecksum"

const require = createRequire(import.meta.url)
require("@next/env").loadEnvConfig(process.cwd())
const database = process.argv[2]
assert.match(database || "", /^ecom_sara_audit_[a-z0-9_]+$/)
assert.ok(Buffer.byteLength(database) <= 38)
assert.ok(process.env.MONGODB_URI)
const secret = crypto.randomBytes(32).toString("hex")
const gateways = process.argv[3]?.startsWith("gateways")
const port = gateways ? 3025 : 3012
Object.assign(process.env, {
  MONGODB_DB: database, DB_NAME: database, NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  NEXT_PUBLIC_APP_URL: `http://localhost:${port}`, NEXTAUTH_URL: `http://localhost:${port}`,
  SMTP_HOST: "127.0.0.1", SMTP_PORT: "1587", SMTP_USER: "audit@example.invalid", SMTP_PASS: secret,
  EMAIL_FROM: "audit@example.invalid", CONTACT_ADMIN_EMAIL: "admin@example.invalid", VENDOR_EMAIL: "vendor@example.invalid",
  RAZORPAY_KEY_ID: `rzp_test_audit_${crypto.randomBytes(8).toString("hex")}`, RAZORPAY_KEY_SECRET: secret,
  AUDIT_PROVIDER_SECRET: secret, SESSION_SECRET: secret, NEXTAUTH_SECRET: secret,
  RECAPTCHA_SECRET_KEY: secret, NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "audit-local-site-key", COOKIE_DOMAIN: "",
  ASKEVA_API_KEY: "", ASKEVA_API_URL: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "",
  NEXT_DIST_DIR: gateways ? ".next-gateway-journeys" : ".next-audit-journey", NEXT_BUILD_CPUS: "2", RATE_LIMIT_BACKEND: "mongodb",
  NEXT_TELEMETRY_DISABLED: "1",
  PINELABS_ENABLED: gateways ? "true" : "false", PAYTM_ENABLED: gateways ? "true" : "false", RAZORPAY_ENABLED: "true",
  PAYMENT_DEFAULT_PROVIDER: gateways ? "pinelabs" : "razorpay",
  PINELABS_ENVIRONMENT: "uat", PINELABS_MERCHANT_ID: "audit-local-merchant",
  PINELABS_CLIENT_ID: "audit-local-client", PINELABS_CLIENT_SECRET: secret, PINELABS_CALLBACK_SECRET: secret,
  PAYTM_ENVIRONMENT: "uat", PAYTM_MERCHANT_ID: "AuditLocalMerchant", PAYTM_MERCHANT_KEY: crypto.randomBytes(8).toString("hex"),
  PAYTM_WEBSITE_NAME: "WEBSTAGING", AUDIT_GATEWAY_JOURNEYS: gateways ? "true" : "false",
})
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 3 })
await client.connect()
const db = client.db(database)
if (process.argv[3] === "cleanup") {
  assert.ok(await db.collection("settings").findOne({ _auditFixture: "customer-ui-audit-v1" }), "Missing own isolated database marker")
  for (const { name } of await db.listCollections().toArray()) {
    await db.collection(name).deleteMany({})
    assert.equal(await db.collection(name).countDocuments({}), 0)
  }
  await client.close()
  console.log("Own isolated customer-audit records removed:", database)
  process.exit(0)
}
const marker = "customer-ui-audit-v1"
const resume = ["resume", "rebuild", "gateways-resume"].includes(process.argv[3])
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
    if (gateways && req.url === "/audit/proof" && req.method === "POST") {
      assert.match(body.email || "", /@example\.invalid$/)
      const user = await db.collection("users").findOne({ email: body.email })
      assert.ok(user?.emailVerified)
      const stored = await db.collection("orders").find({ userId: user._id.toString() }).toArray()
      assert.equal(stored.length, 1)
      const order = stored[0]
      assert.equal(order.items.length, 2)
      assert.ok(order.items.every(item => item.quantity === 1))
      assert.deepEqual(order.items.map(item => item.name).sort(), ["Audit Fixture Television", "Audit Fixture Television Two"])
      assert.equal(order.total, 11998)
      assert.ok(order.paymentMethod === body.provider || (body.provider === "razorpay" && order.paymentMethod === "online"))
      assert.equal(order.status, "confirmed")
      assert.equal(order.paymentDetails.status, "completed")
      const paid = await db.collection("payments").findOne({ orderId: order.orderId })
      assert.ok(paid)
      assert.equal(paid.amount, order.total)
      const intent = await db.collection("checkout_intents").findOne({ orderId: order.orderId })
      assert.equal(intent?.status, "consumed")
      const carts = await db.collection("carts").find({ userId: user._id.toString() }).toArray()
      assert.ok(carts.every(cart => !cart.items?.length))
      return reply(res, 200, { orderId: order.orderId, status: order.status, paymentStatus: order.paymentDetails.status,
        provider: body.provider, amount: order.total, currency: "INR",
        items: order.items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
        paymentRecord: true, intentConsumed: true, cartCleared: true, emailVerified: true })
    }
    if (gateways && req.url === "/audit/capture" && req.method === "POST") {
      const order = orders.get(body.orderId)
      assert.ok(order && order.provider === body.provider)
      order.captured = true
      order.paymentId = `audit_payment_${crypto.randomBytes(8).toString("hex")}`
      let fields
      if (order.provider === "pinelabs") {
        fields = { order_id: order.id, status: "PROCESSED" }
        fields.signature = crypto.createHmac("sha256", Buffer.from(secret, "hex"))
          .update(`order_id=${order.id}&status=PROCESSED`).digest("hex")
      } else {
        fields = { MID: process.env.PAYTM_MERCHANT_ID, ORDERID: order.id, STATUS: "TXN_SUCCESS",
          TXNID: order.paymentId, TXNAMOUNT: (order.amount / 100).toFixed(2) }
        fields.CHECKSUMHASH = await PaytmChecksum.generateSignature(fields, process.env.PAYTM_MERCHANT_KEY)
      }
      return reply(res, 200, { callbackUrl: order.callbackUrl, fields })
    }
    if (req.url === "/audit/payments" && req.method === "POST") {
      const order = orders.get(body.orderId)
      assert.ok(order)
      const id = `pay_audit${crypto.randomBytes(8).toString("hex")}`
      payments.set(id, { id, entity: "payment", order_id: order.id, amount: order.amount, currency: "INR", status: "captured", captured: true, method: "upi" })
      return reply(res, 200, { razorpay_payment_id: id, razorpay_order_id: order.id,
        razorpay_signature: crypto.createHmac("sha256", secret).update(`${order.id}|${id}`).digest("hex") })
    }
    if (req.headers["x-audit-secret"] !== secret) throw new Error("Invalid audit provider credential")
    if (gateways && req.url === "/api/auth/v1/token") {
      assert.equal(body.client_id, process.env.PINELABS_CLIENT_ID)
      assert.equal(body.client_secret, secret)
      return reply(res, 200, { access_token: "audit-local-token", expires_in: 3600 })
    }
    if (gateways && req.url === "/api/checkout/v1/orders") {
      assert.ok(Number.isSafeInteger(body.order_amount?.value) && body.order_amount.value > 0)
      assert.equal(body.callback_url, `http://localhost:${port}/api/payment/pinelabs/return`)
      const id = `audit_pine_${crypto.randomBytes(8).toString("hex")}`
      orders.set(id, { id, provider: "pinelabs", reference: body.merchant_order_reference,
        amount: body.order_amount.value, callbackUrl: body.callback_url })
      return reply(res, 200, { response_code: 200, order_id: id, redirect_url: `https://api.pluralonline.com/audit-checkout/${id}` })
    }
    if (gateways && req.url.startsWith("/api/pay/v1/orders/")) {
      const order = orders.get(req.url.split("/").at(-1))
      assert.ok(order)
      return reply(res, 200, { data: { order_id: order.id, merchant_order_reference: order.reference,
        merchant_id: process.env.PINELABS_MERCHANT_ID, status: order.captured ? "PROCESSED" : "CREATED",
        order_amount: { value: order.amount, currency: "INR" },
        payments: order.captured ? [{ id: order.paymentId, status: "PROCESSED", payment_amount: { value: order.amount, currency: "INR" } }] : [] } })
    }
    if (gateways && (req.url.startsWith("/theia/api/v1/initiateTransaction") || req.url === "/v3/order/status")) {
      assert.ok(PaytmChecksum.verifySignature(JSON.stringify(body.body), process.env.PAYTM_MERCHANT_KEY, body.head.signature))
      assert.equal(body.body.mid, process.env.PAYTM_MERCHANT_ID)
      let result
      if (req.url.startsWith("/theia/")) {
        assert.equal(body.body.callbackUrl, `http://localhost:${port}/api/payment/paytm/return`)
        const id = body.body.orderId
        orders.set(id, { id, provider: "paytm", amount: Math.round(Number(body.body.txnAmount.value) * 100), callbackUrl: body.body.callbackUrl })
        result = { resultInfo: { resultStatus: "S" }, txnToken: `audit_token_${crypto.randomBytes(8).toString("hex")}` }
      } else {
        const order = orders.get(body.body.orderId)
        assert.ok(order)
        result = { resultInfo: { resultStatus: order.captured ? "TXN_SUCCESS" : "PENDING" }, orderId: order.id,
          mid: process.env.PAYTM_MERCHANT_ID, txnAmount: (order.amount / 100).toFixed(2), txnId: order.paymentId }
      }
      return reply(res, 200, { body: result, head: { signature: await PaytmChecksum.generateSignature(JSON.stringify(result), process.env.PAYTM_MERCHANT_KEY) } })
    }
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
  if (gateways) await run(["dev", "-p", String(port), "-H", "127.0.0.1"])
  else {
    if (process.argv[3] === "rebuild" || !fs.existsSync(".next-audit-journey\\BUILD_ID")) await run(["build"])
    await run(["start", "-p", String(port), "-H", "127.0.0.1"])
  }
} finally {
  provider.close(); smtp.close(); await client.close()
}
