import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

function fixture({ status = "confirmed", configured = true, accepted = true, phone = "+91 98765 43210" } = {}) {
  const order = { _id: "fixture-order", orderId: "SARAECOM-123456", status, total: 1234,
    customer: { name: "Fixture Shopper", phone }, items: [{ name: "Fixture phone\nBlack", quantity: 2 }],
    shippingAddress: { street: "Fixture street", city: "Bengaluru", zip: "560001" },
    paymentMethod: "razorpay", paymentVerification: { verified: status === "confirmed" } }
  let claimed = false
  const payloads = [], writes = []
  const collection = {
    findOne: async () => order,
    updateOne: async (filter, update) => {
      writes.push(update)
      if (filter["customerNotifications.confirmationWhatsApp"]) {
        if (claimed) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
        claimed = true
      }
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
    },
  }
  const loader = sourceLoader({ "@/lib/db-service": { getCollection: async () => collection } }, {
    env: configured ? { ASKEVA_API_KEY: "fixture-key", ASKEVA_API_URL: "https://provider.invalid",
      ORDER_CONFIRMATION_WHATSAPP_TEMPLATE: "fixture_confirmation", ORDER_CONFIRMATION_WHATSAPP_LANGUAGE: "en" } : {},
    fetch: async (_url, options) => {
      payloads.push(JSON.parse(options.body))
      return accepted ? Response.json({ messaging_product: "whatsapp", messages: [{ id: "fixture-message" }] })
        : Response.json({ error: "Fixture rejection" }, { status: 400 })
    }, context: { console: { ...console, error() {} } },
  })
  return { order, payloads, writes, service: loader.load("lib/order-confirmation-whatsapp.ts") }
}

test("confirmed orders send one six-parameter approved template across concurrent replays", async () => {
  const f = fixture()
  const results = await Promise.all(Array.from({ length: 3 }, () => f.service.notifyCustomerOrderConfirmed(f.order._id)))
  assert.equal(f.payloads.length, 1)
  assert.equal(results.filter(result => result.status === "accepted").length, 1)
  const payload = f.payloads[0]
  assert.equal(payload.to, "919876543210")
  assert.equal(payload.template.name, "fixture_confirmation")
  const params = payload.template.components[0].parameters.map(param => param.text)
  assert.deepEqual(params, ["Fixture Shopper", "SARAECOM-123456", "Fixture phone Black × 2", "₹1,234.00",
    "Razorpay — payment received", "Delivery to Fixture street, Bengaluru, 560001"])
  assert.equal(f.writes.at(-1).$set["customerNotifications.confirmationWhatsApp.messageId"], "fixture-message")
})

test("pending, failed and review orders never send a confirmation", async () => {
  for (const status of ["pending", "failed", "payment_review", "confirmation_pending", "cancelled"]) {
    const f = fixture({ status })
    assert.equal((await f.service.notifyCustomerOrderConfirmed(f.order._id)).status, "skipped")
    assert.equal(f.payloads.length, 0)
    assert.equal(f.writes.length, 0)
  }
})

test("missing configuration and invalid phones do not claim or contact the provider", async () => {
  for (const options of [{ configured: false }, { phone: "" }, { phone: "12345" }]) {
    const f = fixture(options)
    const result = await f.service.notifyCustomerOrderConfirmed(f.order._id)
    assert.ok(["not_configured", "skipped"].includes(result.status))
    assert.equal(f.payloads.length, 0)
    assert.equal(f.writes.length, 0)
  }
})

test("provider rejection is recorded without resending or changing the order", async () => {
  const f = fixture({ accepted: false })
  assert.equal((await f.service.notifyCustomerOrderConfirmed(f.order._id)).status, "failed")
  assert.equal(f.writes.at(-1).$set["customerNotifications.confirmationWhatsApp.status"], "failed")
  assert.equal((await f.service.notifyCustomerOrderConfirmed(f.order._id)).status, "already_claimed")
  assert.equal(f.payloads.length, 1)
  assert.equal(f.order.status, "confirmed")
})

test("COD and pickup copy does not promise received payment or immediate collection", () => {
  const f = fixture()
  const values = f.service.confirmationWhatsAppValues({ ...f.order, paymentMethod: "cod",
    paymentVerification: { verified: false }, fulfilment: { method: "pickup", storeName: "Fixture store" } })
  assert.match(values[4], /pay when your order arrives/)
  assert.equal(values[4].includes("payment received"), false)
  assert.match(values[5], /Fixture store.*notify you when it is ready/)
})
