import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ObjectId } from "mongodb"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"

const award = {
  promotionId: "fixture-promotion", code: "FREEBAG", promotionName: "Free bag offer", giftId: "fixture-gift", sku: "FREE-BAG",
  name: "Gift Laptop Bag", photo: "/fixture-gift.png", price: 600, mrp: 999, quantity: 2,
  giftAutoAdd: true, giftRemovable: true,
}
const stored = {
  _id: new ObjectId(), orderId: "SARAECOM-00100001", userId: "fixture-owner", status: "confirmed",
  createdAt: "2026-10-26T10:00:00.000Z", total: 1000, paymentMethod: "razorpay",
  items: [{ id: "fixture-product", name: "Purchased Laptop", price: 1000, quantity: 1 }], giftPromotions: [award],
}
const context = { params: Promise.resolve({ id: stored.orderId }) }
function orderFixture(account, order = stored) {
  return sourceLoader({
    "@/lib/auth": { getSession: async () => account ? { user: account } : null },
    "@/lib/db-service": {
      createObjectId: value => new ObjectId(value),
      normalizeId: value => { const { _id, ...rest } = value; return { ...rest, id: String(_id) } },
      getCollection: async name => ({ findOne: async () => name === "orders" ? order : null }),
    },
    "@/lib/emailTemplates": { getEmailTemplate() {}, getEmailSubject() {}, getEmailTemplateId() {} },
    "@/lib/order-notifications": { notifyAdminOrder() {} },
  })
}

for (const [label, account] of [
  ["customer", { id: "fixture-owner", role: "user" }],
  ["admin", { id: "fixture-admin", role: "admin" }],
]) {
  test(`${label} order detail preserves saved gifts through confirmation parsing without changing totals`, async () => {
    const loader = orderFixture(account)
    const response = await loader.load("app/api/orders/[id]/route.ts").GET(new NextRequest(`https://fixture.invalid/api/orders/${stored.orderId}`), context)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(body.giftPromotions, [award])
    const confirmation = loader.load("lib/order-confirmation.ts").OrderConfirmationSchema.parse(body)
    assert.deepEqual(JSON.parse(JSON.stringify(confirmation.giftPromotions)), [award])
    assert.equal(confirmation.total, 1000); assert.equal(confirmation.items.length, 1)
  })
}

test("legacy orders without gifts still return and parse successfully", async () => {
  const { giftPromotions, ...legacy } = stored
  const loader = orderFixture({ id: "fixture-owner", role: "user" }, legacy)
  const response = await loader.load("app/api/orders/[id]/route.ts").GET(new NextRequest("https://fixture.invalid/api/orders/fixture"), context)
  const body = await response.json()
  assert.deepEqual(body.giftPromotions, [])
  const schema = loader.load("lib/order-confirmation.ts").OrderConfirmationSchema
  assert.equal(schema.safeParse(body).success, true)
  delete body.giftPromotions
  assert.equal(schema.safeParse(body).success, true)
})

test("unrelated customers cannot read saved gift details", async () => {
  const response = await orderFixture({ id: "unrelated", role: "user" }).load("app/api/orders/[id]/route.ts").GET(
    new NextRequest("https://fixture.invalid/api/orders/fixture"), context)
  assert.equal(response.status, 404); assert.equal((await response.text()).includes(award.name), false)
})

const displayLoader = () => sourceLoader({
  react: { ...React, useEffect() {}, useState: initial => [initial, () => {}] },
  "@/hooks/useCart": { useCart: () => ({ addToCart() {} }) },
  "next/link": props => React.createElement("a", props, props.children),
  "./OrderSuccess.module.css": {},
})

test("thank-you order summary renders the saved gift photo, SKU, quantity and FREE price", () => {
  const loader = displayLoader()
  const OrderSuccess = loader.load("components/OrderSuccess.tsx").default
  const order = loader.load("lib/order-confirmation.ts").OrderConfirmationSchema.parse(stored)
  const markup = renderToStaticMarkup(React.createElement(OrderSuccess, { order }))
  for (const expected of ["Free gifts included", award.name, award.photo, "SKU: FREE-BAG", "Qty: 2", "FREE", "Purchased Laptop"]) assert.ok(markup.includes(expected), expected)
  assert.doesNotMatch(markup, /₹(?:600|1,200)(?:<|[.\s])/u, "gift reference prices must not be charged")
})

test("admin gift packing list renders every saved gift and offer, and hides for orders without gifts", () => {
  const OrderGiftItems = displayLoader().load("components/OrderGiftItems.tsx").default
  const second = { ...award, promotionId: "second-promotion", giftId: "second-gift", name: "Gift Mouse", sku: "FREE-MOUSE", quantity: 1 }
  const markup = renderToStaticMarkup(React.createElement(OrderGiftItems, {
    gifts: [award, second], heading: "Free gifts to include with this order", showPromotion: true,
  }))
  for (const expected of [award.name, second.name, "FREE-BAG", "FREE-MOUSE", "Qty: 2", "Qty: 1", "Offer: FREEBAG"]) assert.ok(markup.includes(expected), expected)
  assert.equal((markup.match(/>FREE<\/span>/g) || []).length, 2)
  assert.equal(renderToStaticMarkup(React.createElement(OrderGiftItems, { gifts: [] })), "")
})

test("admin order detail displays gifts returned by the order API", () => {
  const data = { ...stored, id: String(stored._id), subtotal: 1000, tax: 0, shipping: 0, updatedAt: stored.createdAt,
    customer: { name: "Fixture Customer", email: "fixture@example.invalid", phone: "", address: "" },
    paymentDetails: {}, items: stored.items.map(item => ({ ...item, productId: item.id })) }
  let stateIndex = 0
  const loader = sourceLoader({
    react: { ...React, use: () => ({ id: String(stored._id) }), useEffect() {}, useRef: initial => ({ current: initial }),
      useState: initial => { const index = stateIndex++; return [index === 0 ? data : index === 1 ? false : initial, () => {}] } },
    "@/contexts/AuthContext": { useAuth: () => ({ user: { id: "fixture-admin" }, isLoading: false, canAccessAdmin: true }) },
    "next/link": props => React.createElement("a", props, props.children),
  })
  const OrderDetail = loader.load("app/admin/orders/[id]/page.tsx").default
  const markup = renderToStaticMarkup(React.createElement(OrderDetail, { params: Promise.resolve({ id: String(stored._id) }) }))
  for (const expected of ["Free gifts to include with this order", award.name, award.photo, "SKU: FREE-BAG", "Qty: 2", "FREE", "Offer: FREEBAG"]) assert.ok(markup.includes(expected), expected)
})
