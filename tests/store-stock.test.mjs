import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"
import { ObjectId } from "mongodb"
import * as XLSX from "xlsx"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"

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
        find: () => ({ toArray: async () => name === "store_locations"
          ? known.stores.map((storeCode, index) => ({ _id: String(index), storeCode }))
          : known.skus.map((sku, index) => ({ _id: String(index), sku })) }),
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

test("stock Excel headers ignore case, spaces and punctuation and preserve formatted identifier zeros", () => {
  const { parseStoreStockRows, readStoreStockSpreadsheet } = sourceLoader().load("lib/store-stock-import.ts")
  for (const bookType of ["xlsx", "xls"]) {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([["ITEM NO.", "store_code", "QUANTITY"], [123, 7, 5], [123, 8, 3]])
    sheet.A2.z = sheet.A3.z = "00000"
    sheet.B2.z = sheet.B3.z = "000"
    XLSX.utils.book_append_sheet(workbook, sheet, "Stock")
    const parsed = parseStoreStockRows(readStoreStockSpreadsheet(XLSX.write(workbook, { type: "array", bookType })))
    assert.deepEqual(JSON.parse(JSON.stringify(parsed.rows)), [
      { itemCode: "00123", storeCode: "007", quantity: 5 }, { itemCode: "00123", storeCode: "008", quantity: 3 },
    ])
  }
  assert.throws(() => parseStoreStockRows([{ "Item No": "T1", "Store Code": "S1", Qty: "" }]), /Enter 0 explicitly/)
  assert.throws(() => parseStoreStockRows([{ "Wrong Column": "T1" }]), /use the columns/)
  assert.throws(() => parseStoreStockRows([{ itemno: "T1", SKU: "T2", StoreCode: "S1", Qty: 2 }]), /Conflicting/)
  assert.throws(() => parseStoreStockRows([{ itemno: "T1", StoreCode: "S1", Qty: 2.5 }]), /whole number/)
  assert.equal(parseStoreStockRows([{ itemno: "T1", StoreCode: "S1", Qty: 0 }]).rows[0].quantity, 0)
})

const listSets = new WeakMap()
function listContains(list, value) {
  if (!listSets.has(list)) listSets.set(list, new Set(list.map(item => String(item).toUpperCase())))
  return listSets.get(list).has(String(value).toUpperCase())
}
function matches(doc, filter) {
  return Object.entries(filter).every(([field, value]) => {
    if (field === "$or") return value.some(clause => matches(doc, clause))
    if (field === "$expr") return listContains(value.$in[1], doc.raw?.["Item No."] || "")
    const actual = field.split(".").reduce((parent, part) => parent?.[part], doc)
    const equal = other => typeof actual === "string" && typeof other === "string" ? actual.toUpperCase() === other.toUpperCase() : String(actual) === String(other)
    if (value && typeof value === "object") {
      if ("$in" in value) return listContains(value.$in, actual)
      if ("$nin" in value) return !value.$nin.some(equal)
      if ("$gt" in value) return actual > value.$gt
      if ("$exists" in value) return (actual !== undefined) === value.$exists
    }
    return equal(value)
  })
}

function stockImportFixture({ fail = false, legacy = false, failStockBatch = 0 } = {}) {
  const ids = [new ObjectId(), new ObjectId()]
  const data = {
    products: [{ _id: "p1", ...(legacy ? {} : { sku: "SKU-1" }), itemno: "00123", name: "Fixture Laptop", active: true, price: 1000, stock: 1 },
      { _id: "p2", sku: "OTHER", active: true, price: 100, stock: 11 }],
    store_locations: ids.map((_id, index) => ({ _id, storeCode: `BLR00${index + 1}`, isActive: true, locationType: "store" })),
    store_stock: [{ storeCode: "BLR001", sku: "OTHER", quantity: 7 }, { storeCode: "BLR002", sku: "OTHER", quantity: 4 }],
  }
  const session = { withTransaction: async work => {
    const previous = { products: structuredClone(data.products), store_stock: structuredClone(data.store_stock),
      store_locations: data.store_locations.map(store => ({ ...store })) }
    try { return await work() } catch (error) { Object.assign(data, previous); throw error }
  }, endSession: async () => {} }
  const cursor = rows => ({ toArray: async () => rows, sort() { return this } })
  const batches = []
  const collection = name => ({
    find: filter => cursor((data[name] || []).filter(doc => matches(doc, filter))),
    findOne: async filter => (data[name] || []).find(doc => matches(doc, filter)) || null,
    distinct: async (field, filter) => [...new Set((data[name] || []).filter(doc => matches(doc, filter)).map(doc => doc[field]))],
    updateMany: async filter => ({ matchedCount: (data[name] || []).filter(doc => matches(doc, filter)).length }),
    aggregate: pipeline => {
      const totals = new Map()
      for (const row of data.store_stock.filter(doc => matches(doc, pipeline[0].$match))) totals.set(row.sku, (totals.get(row.sku) || 0) + row.quantity)
      return cursor([...totals].map(([_id, total]) => ({ _id, total })))
    },
    bulkWrite: async operations => {
      batches.push({ collection: name, count: operations.length })
      if (name === "store_stock" && failStockBatch && batches.filter(batch => batch.collection === name).length === failStockBatch) throw new Error("Injected later stock batch failure")
      if (fail && name === "products") throw new Error("Injected stock total failure")
      let modifiedCount = 0
      const byId = new Map(data[name].map(doc => [String(doc._id), doc]))
      const byPair = new Map(data[name].map(doc => [`${doc.storeCode}:${doc.sku}`, doc]))
      for (const operation of operations) {
        const update = operation.updateOne || operation.updateMany
        const candidate = update.filter._id ? byId.get(String(update.filter._id)) : byPair.get(`${update.filter.storeCode}:${update.filter.sku}`)
        let matched = candidate && matches(candidate, update.filter) ? [candidate] : []
        if (!matched.length && update.upsert) {
          const row = { ...update.filter }; data[name].push(row); matched = [row]
          byPair.set(`${row.storeCode}:${row.sku}`, row)
        }
        for (const doc of matched) { Object.assign(doc, update.update.$set); modifiedCount++ }
      }
      return { modifiedCount }
    },
  })
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: "fixture-admin" } }) },
    "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products" }, getCollection: async name => collection(name) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client: { startSession: () => session } }) },
  })
  const route = loader.load("app/api/admin/store-stock/route.ts")
  const send = (rows, replaceStores = false, options = {}) => route.POST(new NextRequest("https://fixture.invalid/api/admin/store-stock", {
    method: "POST", body: JSON.stringify({ rows, replaceStores, ...options }),
  }))
  return { data, ids, loader, send, batches }
}

test("upload keeps separate quantities per store, updates cumulative product stock and limits pickup to stocked stores", async () => {
  const fx = stockImportFixture()
  assert.equal((await fx.send([{ itemCode: "00123", storeCode: "blr001", quantity: 5 }, { itemCode: "00123", storeCode: "BLR002", quantity: 3 }])).status, 200)
  assert.equal(fx.data.products[0].stock, 8)
  assert.deepEqual(fx.data.store_stock.filter(row => row.sku === "SKU-1").map(row => row.quantity), [5, 3])
  assert.equal(fx.data.products[1].stock, 11)
  const availability = await fx.loader.load("lib/store-stock.ts").getStoreStockAvailability([{ sku: "SKU-1", itemCode: "00123", quantity: 4 }])
  assert.deepEqual([...availability.storeIds], [String(fx.ids[0])])
  assert.equal(availability.byStore[String(fx.ids[1])][0].available, 3)
  assert.equal(availability.byStore[String(fx.ids[1])][0].itemCode, "00123")
  assert.equal((await fx.send([{ itemCode: "00123", storeCode: "BLR001", quantity: 2 }])).status, 200)
  assert.equal(fx.data.products[0].stock, 5, "other store's three units are retained")
  assert.equal(fx.data.store_stock.find(row => row.sku === "OTHER" && row.storeCode === "BLR001").quantity, 7)
  const lookup = await fx.loader.load("app/api/admin/store-stock/route.ts").GET(new NextRequest("https://fixture.invalid/api/admin/store-stock?itemCode=00123"))
  const body = await lookup.json()
  assert.equal(body.product.stock, 5); assert.equal(body.rows.length, 2)
})

test("legacy itemno-only products work from upload through trusted catalogue pricing and pickup availability", async () => {
  const fx = stockImportFixture({ legacy: true })
  assert.equal((await fx.send([{ itemCode: "00123", storeCode: "BLR001", quantity: 5 }])).status, 200)
  assert.equal(fx.data.products[0].stock, 5)
  const stock = fx.loader.load("lib/store-stock.ts")
  assert.equal((await stock.itemCodesFor(["p1"])).get("p1"), "00123")
  const pricing = await fx.loader.load("lib/order-pricing.ts").priceCatalogueCart([{ id: "p1", quantity: 2, sku: "FORGED" }], undefined, "store")
  assert.equal(pricing.ok, true); assert.equal(pricing.items[0].sku, "00123")
  assert.deepEqual([...await stock.storesHoldingStock([{ sku: pricing.items[0].sku, quantity: 2 }])], [String(fx.ids[0])])
})

test("full-store replacement is explicit and stock totals roll back with a failed upload", async () => {
  const fx = stockImportFixture()
  const response = await fx.send([{ itemCode: "00123", storeCode: "BLR001", quantity: 5 }], true)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).zeroedItems, 1)
  assert.equal(fx.data.products[1].stock, 4)
  assert.equal(fx.data.store_stock.find(row => row.sku === "OTHER" && row.storeCode === "BLR002").quantity, 4)
  const failing = stockImportFixture({ fail: true })
  const before = JSON.stringify(failing.data)
  assert.equal((await failing.send([{ itemCode: "00123", storeCode: "BLR001", quantity: 5 }])).status, 500)
  assert.equal(JSON.stringify(failing.data), before)
})

test("different aliases of one item cannot overwrite each other in a single store upload", async () => {
  const fx = stockImportFixture()
  const response = await fx.send([{ itemCode: "00123", storeCode: "BLR001", quantity: 5 }, { itemCode: "SKU-1", storeCode: "BLR001", quantity: 3 }])
  assert.equal(response.status, 400)
  assert.match((await response.json()).message, /multiple.*aliases/)
  assert.equal(fx.data.products[0].stock, 1)
})

test("stock totals do not overwrite another product merely sharing an item-number alias", async () => {
  const fx = stockImportFixture()
  fx.data.products[1].itemno = "SKU-1"
  assert.equal((await fx.send([{ itemCode: "00123", storeCode: "BLR001", quantity: 5 }])).status, 200)
  assert.equal(fx.data.products[0].stock, 5)
  assert.equal(fx.data.products[1].stock, 11)
})

test("legacy Excel raw Item No. keys containing a literal period can be uploaded", async () => {
  const fx = stockImportFixture({ legacy: true })
  delete fx.data.products[0].itemno
  fx.data.products[0].raw = { "Item No.": "RAW-1" }
  assert.equal((await fx.send([{ itemCode: "RAW-1", storeCode: "BLR001", quantity: 5 }])).status, 200)
  assert.equal(fx.data.products[0].stock, 5)
})

test("a stock upload rejects bad quantities and repeated store items, and reports unknown rows without writing", async () => {
  const route = uploadRoute()
  assert.equal((await route.POST(upload([{ itemCode: "T1", storeCode: "BLR001", quantity: -1 }]))).status, 400)
  assert.equal((await route.POST(upload([{ itemCode: "T1", storeCode: "BLR001", quantity: 1.5 }]))).status, 400)

  const repeated = await route.POST(upload([{ itemCode: "T1", storeCode: "BLR001", quantity: 1 }, { itemCode: "T1", storeCode: "BLR001", quantity: 2 }]))
  assert.equal(repeated.status, 400)
  assert.match((await repeated.json()).message, /one quantity per item and store/)

  const unknown = await route.POST(upload([{ itemCode: "T9", storeCode: "XXX", quantity: 1 }]))
  assert.equal(unknown.status, 200)
  const body = await unknown.json()
  assert.deepEqual([[...body.unknownStores], [...body.unknownItems], body.skippedRows], [["XXX"], ["T9"], 1])
  assert.equal(body.saved, 0)
  assert.deepEqual(body.skippedRecords, [{ index: 0, reason: "Unknown Item No. and Store Code" }])
})

test("preview is read-only and shows previous/new store quantities and cumulative totals before applying valid rows", async () => {
  const fx = stockImportFixture()
  const rows = [
    { itemCode: "00123", storeCode: "BLR001", quantity: 5 },
    { itemCode: "00123", storeCode: "BLR002", quantity: 3 },
    { itemCode: "UNKNOWN", storeCode: "BLR001", quantity: 9 },
    { itemCode: "00123", storeCode: "UNKNOWN", quantity: 8 },
  ]
  const before = JSON.stringify(fx.data)
  const response = await fx.send(rows, false, { preview: true })
  assert.equal(response.status, 200)
  const preview = await response.json()
  assert.equal(JSON.stringify(fx.data), before)
  assert.equal(preview.preview, true); assert.equal(preview.validRows, 2); assert.equal(preview.saved, 0)
  assert.deepEqual(preview.skippedRecords, [{ index: 2, reason: "Unknown Item No." }, { index: 3, reason: "Unknown Store Code" }])
  assert.deepEqual(preview.changes.map(row => [row.itemCode, row.storeCode, row.previousOverallStock, row.currentOverallStock, row.previousStoreStock, row.currentStoreStock]),
    [["00123", "BLR001", 1, 8, 0, 5], ["00123", "BLR002", 1, 8, 0, 3]])
  const applied = await fx.send(rows, false, { previewToken: preview.previewToken })
  assert.equal(applied.status, 200); assert.equal((await applied.json()).saved, 2)
  assert.equal(fx.data.products[0].stock, 8)
  assert.equal(fx.data.store_stock.some(row => row.sku === "UNKNOWN" || row.storeCode === "UNKNOWN"), false)
  const next = await (await fx.send([{ ...rows[0], quantity: 2 }], false, { preview: true })).json()
  assert.deepEqual([next.changes[0].previousOverallStock, next.changes[0].currentOverallStock, next.changes[0].previousStoreStock, next.changes[0].currentStoreStock], [8, 5, 5, 2])
})

test("changed stock invalidates the preview and applies nothing until the preview is refreshed", async () => {
  const fx = stockImportFixture()
  const rows = [{ itemCode: "00123", storeCode: "BLR001", quantity: 5 }]
  const preview = await (await fx.send(rows, false, { preview: true })).json()
  await fx.send([{ ...rows[0], quantity: 2 }])
  const before = JSON.stringify(fx.data)
  const stale = await fx.send(rows, false, { previewToken: preview.previewToken })
  assert.equal(stale.status, 409); assert.equal(JSON.stringify(fx.data), before)
  assert.equal((await fx.send(rows, false, { preview: true, previewToken: preview.previewToken })).status, 409)
  const refreshed = await (await fx.send(rows, false, { preview: true })).json()
  assert.notEqual(refreshed.previewToken, preview.previewToken)
  assert.equal((await fx.send(rows, false, { previewToken: refreshed.previewToken })).status, 200)
  assert.equal(fx.data.products[0].stock, 5)
})

test("replacement previews omitted stock, but unknown item rows protect that store's omitted inventory", async () => {
  const fx = stockImportFixture()
  const rows = [{ itemCode: "00123", storeCode: "BLR001", quantity: 5 }]
  const preview = await (await fx.send(rows, true, { preview: true })).json()
  const omitted = preview.changes.find(row => row.source === "omitted")
  assert.deepEqual([omitted.sku, omitted.storeCode, omitted.previousOverallStock, omitted.currentOverallStock, omitted.previousStoreStock, omitted.currentStoreStock], ["OTHER", "BLR001", 11, 4, 7, 0])
  const mixed = [...rows, { itemCode: "UNKNOWN", storeCode: "BLR001", quantity: 2 }]
  const safe = await (await fx.send(mixed, true, { preview: true })).json()
  assert.equal(safe.zeroedItems, 0); assert.deepEqual(safe.preservedStores, ["BLR001"])
  assert.equal((await fx.send(mixed, true, { previewToken: safe.previewToken })).status, 200)
  assert.equal(fx.data.products[1].stock, 11)
  assert.equal(fx.data.store_stock.find(row => row.sku === "OTHER" && row.storeCode === "BLR001").quantity, 7)
})

test("large previews page all changes with a stable token and retain all skipped row references", async () => {
  const fx = stockImportFixture()
  const rows = Array.from({ length: 205 }, (_, index) => ({ itemCode: `NEW-${index}`, storeCode: "BLR001", quantity: index }))
  fx.data.products.push(...rows.map(row => ({ _id: row.itemCode, sku: row.itemCode, stock: 0 })))
  rows.push(...Array.from({ length: 25 }, (_, index) => ({ itemCode: `UNKNOWN-${index}`, storeCode: "BLR001", quantity: 1 })))
  const first = await (await fx.send(rows, false, { preview: true })).json()
  assert.equal(first.changes.length, 200); assert.equal(first.totalChanges, 205)
  assert.equal(first.skippedRecords.length, 25); assert.equal(first.skippedRecords[24].index, 229)
  const second = await (await fx.send(rows, false, { preview: true, previewPage: 1, previewToken: first.previewToken })).json()
  assert.equal(second.changes.length, 5); assert.equal(second.previewToken, first.previewToken)
  assert.equal(new Set([...first.changes, ...second.changes].map(row => row.sku)).size, 205)
})

test("an 18,000-row Excel sheet updates existing items only and retains unlisted stock", async () => {
  const fx = stockImportFixture()
  const knownRows = Array.from({ length: 17000 }, (_, index) => ({ itemno: `ITEM${index}`, StoreCode: "BLR001", Quantity: index % 10 }))
  const unknownRows = Array.from({ length: 1000 }, (_, index) => ({ itemno: `UNKNOWN${index}`, StoreCode: "BLR001", Quantity: 99 }))
  fx.data.products.push(...knownRows.map(row => ({ _id: row.itemno, itemno: row.itemno, stock: 0 })))
  const productCount = fx.data.products.length
  const { readStoreStockSpreadsheet, parseStoreStockRows } = fx.loader.load("lib/store-stock-import.ts")
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([...knownRows, ...unknownRows]), "Stock")
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
  assert.ok(bytes.byteLength < 10 * 1024 * 1024)
  const { rows } = parseStoreStockRows(readStoreStockSpreadsheet(bytes))
  assert.equal(rows.length, 18000)
  const preview = await (await fx.send(rows, false, { preview: true })).json()
  assert.equal(preview.validRows, 17000)
  assert.equal(preview.skippedRows, 1000)
  assert.equal(preview.totalChanges, 17000)
  assert.equal(preview.changes.length, 200)
  assert.equal(fx.batches.length, 0)
  const response = await fx.send(rows, false, { previewToken: preview.previewToken })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.saved, 17000)
  assert.equal(result.skippedRows, 1000)
  assert.equal(result.productsUpdated, 17000)
  assert.equal(result.zeroedItems, 0)
  assert.equal(fx.data.products.length, productCount)
  assert.equal(fx.data.products[0].stock, 1)
  assert.equal(fx.data.products[1].stock, 11)
  assert.equal(fx.data.store_stock.some(row => row.sku.startsWith("UNKNOWN")), false)
  const storedProducts = new Map(fx.data.products.map(product => [product.itemno, product]))
  for (const row of knownRows) assert.equal(storedProducts.get(row.itemno).stock, row.Quantity)
  assert.equal(fx.batches.filter(batch => batch.collection === "store_stock").length, 34)
  assert.equal(fx.batches.filter(batch => batch.collection === "products").length, 34)
  assert.ok(fx.batches.every(batch => batch.count <= 500))
})

test("a failure in a later stock batch rolls back every earlier batch", async () => {
  const fx = stockImportFixture({ failStockBatch: 2 })
  const rows = Array.from({ length: 501 }, (_, index) => ({ itemCode: `ITEM${index}`, storeCode: "BLR001", quantity: 5 }))
  fx.data.products.push(...rows.map(row => ({ _id: row.itemCode, itemno: row.itemCode, stock: 0 })))
  const before = JSON.stringify(fx.data)
  assert.equal((await fx.send(rows)).status, 500)
  assert.equal(JSON.stringify(fx.data), before)
  assert.deepEqual(fx.batches.map(batch => batch.count), [500, 1])
})

test("Google Sheets stock CSV preserves leading zeros and updates matching items only", async () => {
  const fx = stockImportFixture()
  const requests = []
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
  }, { fetch: async (url, options) => {
    requests.push(url)
    assert.equal(options.cache, "no-store")
    return new Response("itemno,Store Code,Quantity\n00123,BLR001,5\nUNKNOWN,BLR001,9\n")
  } })
  const route = loader.load("app/api/admin/store-stock/google-sheet/route.ts")
  const response = await route.POST(new NextRequest("https://fixture.invalid/api/admin/store-stock/google-sheet", {
    method: "POST", body: JSON.stringify({ sheetId: "https://docs.google.com/spreadsheets/d/FIXTURE/edit#gid=42" }),
  }))
  assert.equal(response.status, 200)
  assert.deepEqual(requests, ["https://docs.google.com/spreadsheets/d/FIXTURE/export?format=csv&gid=42"])
  const sheet = await response.json()
  assert.equal(sheet.rows[0].itemno, "00123")
  const { rows } = fx.loader.load("lib/store-stock-import.ts").parseStoreStockRows(sheet.rows)
  const preview = await (await fx.send(rows, false, { preview: true })).json()
  assert.equal(preview.validRows, 1)
  assert.equal(preview.skippedRows, 1)
  const result = await (await fx.send(rows, false, { previewToken: preview.previewToken })).json()
  assert.equal(result.saved, 1)
  assert.equal(result.skippedRows, 1)
  assert.equal(fx.data.products[0].stock, 5)
  assert.equal(fx.data.products[1].stock, 11)
  assert.equal(fx.data.store_stock.some(row => row.sku === "UNKNOWN"), false)
})

test("skipped Excel download preserves identifier zeros, original quantities and reasons as text cells", () => {
  const { skippedStockWorkbook } = sourceLoader().load("lib/store-stock-import.ts")
  const rows = [{ itemCode: "00123", storeCode: "007", quantity: 9 }, { itemCode: "=UNKNOWN", storeCode: "008", quantity: 0 }]
  const workbook = skippedStockWorkbook(rows, [{ index: 0, reason: "Unknown Store Code" }, { index: 1, reason: "Unknown Item No." }])
  const result = XLSX.read(XLSX.write(workbook, { type: "array", bookType: "xlsx" }), { type: "array" })
  const sheet = result.Sheets["Skipped Rows"]
  assert.deepEqual(XLSX.utils.sheet_to_json(sheet), [
    { "Item No.": "00123", "Store Code": "007", Quantity: 9, Reason: "Unknown Store Code" },
    { "Item No.": "=UNKNOWN", "Store Code": "008", Quantity: 0, Reason: "Unknown Item No." },
  ])
  assert.equal(sheet.A3.t, "s"); assert.equal(sheet.A3.f, undefined)
})

test("the stock page previews an Excel upload and saves only when Apply is clicked", async () => {
  const fx = stockImportFixture()
  const states = [], refs = [], calls = []
  let stateIndex = 0, refIndex = 0
  const toast = { loading: () => "fixture", success: () => {}, error: message => { throw new Error(message) } }
  const page = sourceLoader({
    react: { ...React, useEffect: () => {}, useState: initial => {
      const index = stateIndex++
      if (!(index in states)) states[index] = initial
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value }]
    }, useRef: initial => {
      const index = refIndex++
      if (!(index in refs)) refs[index] = { current: initial }
      return refs[index]
    } },
    "react-hot-toast": { toast },
    "@/lib/api-client": { apiFetch: async (_url, options) => {
      if (!options) return Response.json({ success: true, stores: [] })
      const payload = JSON.parse(options.body)
      calls.push(payload)
      return fx.send(payload.rows, payload.replaceStores, payload)
    } },
  }).load("app/admin/stock-check/page.tsx").default
  const render = () => { stateIndex = 0; refIndex = 0; return page() }
  const flatten = node => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)]
  const label = node => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(label).join("") : label(node?.props?.children || "")
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { "Item No.": "00123", "Store Code": "BLR001", Quantity: 5 },
    { "Item No.": "UNKNOWN", "Store Code": "BLR001", Quantity: 2 },
  ]), "Stock")
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
  const before = JSON.stringify(fx.data)
  const input = flatten(render()).find(node => node.type === "input" && node.props.type === "file")
  await input.props.onChange({ target: { files: [{ name: "stock.xlsx", size: buffer.byteLength, arrayBuffer: async () => buffer }] } })
  assert.equal(calls.length, 1); assert.equal(calls[0].preview, true)
  assert.equal(calls[0].replaceStores, false)
  assert.equal(JSON.stringify(fx.data), before, "uploading must not save stock")
  const preview = render()
  const markup = renderToStaticMarkup(preview)
  assert.ok(!markup.includes("Replace the complete inventory"))
  for (const text of ["Stock change preview", "Previous overall stock", "New overall stock", "Previous store stock", "New store stock", "BLR001", "Download skipped rows (1)"]) assert.ok(markup.includes(text), text)
  const apply = flatten(preview).find(node => node.type === "button" && label(node).startsWith("Apply 1 valid"))
  assert.equal(apply.props.disabled, false)
  await apply.props.onClick()
  // The React click handler starts an asynchronous save without returning it.
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.length, 2); assert.equal(calls[1].preview, undefined)
  assert.equal(calls[1].replaceStores, false)
  assert.match(calls[1].previewToken, /^[a-f0-9]{64}$/)
  assert.equal(fx.data.products[0].stock, 5)
  assert.equal(fx.data.products[1].stock, 11, "items omitted from the sheet retain their stock")
  assert.ok(renderToStaticMarkup(render()).includes("Stock changes saved"))
})
