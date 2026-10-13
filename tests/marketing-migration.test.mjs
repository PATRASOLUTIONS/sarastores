import test from "node:test"
import assert from "node:assert/strict"
import { buildPlan, MARKETING_COLLECTIONS } from "../scripts/migrate-marketing-content.mjs"

test("migration excludes orders, customers, payments, catalog and settings", () => {
  const plan = buildPlan({ orders: [{ _id: "order" }], products: [{ _id: "product" }] }, {})
  assert.deepEqual(plan.map((item) => item.collection), [...MARKETING_COLLECTIONS])
  for (const name of ["orders", "users", "payments", "products", "settings", "footer"]) {
    assert.equal(MARKETING_COLLECTIONS.includes(name), false)
  }
  assert.equal(plan.reduce((sum, item) => sum + item.changes.length, 0), 0)
})

test("plan updates matching IDs, adds missing IDs and preserves target-only content", () => {
  const plan = buildPlan(
    { hero_slides: [{ _id: "shared", title: "new" }, { _id: "new", title: "added" }] },
    { hero_slides: [{ _id: "shared", title: "old" }, { _id: "keep", title: "retained" }] },
  )
  const entry = plan.find((item) => item.collection === "hero_slides")
  assert.equal(entry.insert, 1)
  assert.equal(entry.update, 1)
  assert.equal(entry.targetOnlyPreserved, 1)
  assert.deepEqual(entry.changes.map((doc) => doc._id), ["shared", "new"])
})

test("empty source does not clear destination and unchanged records are not written", () => {
  const plan = buildPlan(
    { offers: [{ _id: "same", active: true }] },
    { offers: [{ _id: "same", active: true }], testimonials: [{ _id: "keep" }] },
  )
  assert.equal(plan.find((item) => item.collection === "offers").changes.length, 0)
  assert.equal(plan.find((item) => item.collection === "offers").unchanged, 1)
  assert.equal(plan.find((item) => item.collection === "testimonials").targetOnlyPreserved, 1)
})
