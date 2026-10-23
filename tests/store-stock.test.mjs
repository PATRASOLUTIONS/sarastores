import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"

const STORES = [
  { _id: "s1", storeCode: "BLR001", isActive: true },
  { _id: "s2", storeCode: "BLR002", isActive: true },
  { _id: "s3", storeCode: "", isActive: true },
  { _id: "s4", storeCode: "MYS001", isActive: false },
]
const STOCK = [
  { storeCode: "BLR001", sku: "T1", quantity: 5 },
  { storeCode: "BLR001", sku: "T2", quantity: 1 },
  { storeCode: "BLR002", sku: "T1", quantity: 1 },
  { storeCode: "MYS001", sku: "T1", quantity: 9 },
]

const inList = (value, condition) => !condition?.$in || condition.$in.includes(value)

function fakeCollections(data) {
  return async name => ({
    find: filter => ({
      toArray: async () => (data[name] || []).filter(doc => {
        if (name === "store_locations") return doc.isActive !== false && typeof doc.storeCode === "string" && doc.storeCode !== ""
        if (name === "store_stock") return inList(doc.sku, filter.sku) && inList(doc.storeCode, filter.storeCode)
        return true
      }),
    }),
  })
}

const loadStock = (env = {}) => sourceLoader({
  "@/lib/db-service": { getCollection: fakeCollections({ store_locations: STORES, store_stock: STOCK }), COLLECTIONS: { PRODUCTS: "products" } },
}, { env }).load("lib/store-stock.ts")

test("only active stores with a store code that hold every item in full are offered", async () => {
  const stock = loadStock()
  assert.deepEqual([...await stock.storesHoldingStock([{ sku: "T1", quantity: 1 }])].sort(), ["s1", "s2"])
  assert.deepEqual([...await stock.storesHoldingStock([{ sku: "T1", quantity: 2 }])], ["s1"], "a store short of the quantity is hidden")
  assert.deepEqual([...await stock.storesHoldingStock([{ sku: "T1", quantity: 1 }, { sku: "T2", quantity: 1 }])], ["s1"], "every item must be held")
  assert.deepEqual([...await stock.storesHoldingStock([{ sku: "T1", quantity: 3 }, { sku: "T1", quantity: 3 }])], [], "repeated lines add up")
  assert.equal((await stock.storesHoldingStock([{ sku: null, quantity: 1 }])).size, 0, "an item without an item code rules every store out")
  assert.equal((await stock.storesHoldingStock([{ sku: "T9", quantity: 1 }])).size, 0, "a store with no uploaded stock is hidden")
})

test("the far-store distance comes from STORE_PICKUP_FAR_KM with a 15 km default, and the nudge only shows beyond it", () => {
  assert.equal(loadStock().storeFarDistanceKm(), 15)
  assert.equal(loadStock({ STORE_PICKUP_FAR_KM: "25" }).storeFarDistanceKm(), 25)
  assert.equal(loadStock({ STORE_PICKUP_FAR_KM: "nonsense" }).storeFarDistanceKm(), 15)

  const { farStoreMessage } = sourceLoader().load("hooks/useStoreStock.ts")
  assert.equal(farStoreMessage(null, 15), "", "no distance when the pincode could not be located")
  assert.equal(farStoreMessage(12, 15), "")
  assert.match(farStoreMessage(34.4, 15), /about 34 km .* buying online/)
})

function uploadRoute(known = { stores: ["BLR001"], skus: ["T1"] }) {
  return sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: "admin" } }) },
    "@/lib/db-service": {
      COLLECTIONS: { PRODUCTS: "products" },
      getCollection: async name => ({
        distinct: async (_field, filter) => (name === "store_locations" ? known.stores : known.skus)
          .filter(value => filter.storeCode ? filter.storeCode.$in.includes(value) : filter.sku.$in.includes(value)),
      }),
    },
    "@/lib/mongodb": { connectToDatabase: async () => { throw new Error("no transaction expected") } },
  }).load("app/api/admin/store-stock/route.ts")
}
const upload = rows => new NextRequest("https://fixture.invalid/api/admin/store-stock", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }),
})

test("a stock upload rejects bad quantities, repeated store items and sheets with nothing recognisable", async () => {
  const route = uploadRoute()
  assert.equal((await route.POST(upload([{ itemCode: "T1", storeCode: "BLR001", quantity: -1 }]))).status, 400)
  assert.equal((await route.POST(upload([{ itemCode: "T1", storeCode: "BLR001", quantity: 1.5 }]))).status, 400)

  const repeated = await route.POST(upload([{ itemCode: "T1", storeCode: "BLR001", quantity: 1 }, { itemCode: "T1", storeCode: "BLR001", quantity: 2 }]))
  assert.equal(repeated.status, 400)
  assert.match((await repeated.json()).message, /T1 @ BLR001/)

  const unknown = await route.POST(upload([{ itemCode: "T9", storeCode: "XXX", quantity: 1 }]))
  assert.equal(unknown.status, 400)
  const body = await unknown.json()
  assert.deepEqual([[...body.unknownStores], [...body.unknownItems], body.skippedRows], [["XXX"], ["T9"], 1])
})
