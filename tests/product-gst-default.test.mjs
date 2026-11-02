import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"
import * as XLSX from "xlsx"
import { sourceLoader } from "./source-loader.mjs"

function fixture() {
  const records = new Map()
  const collection = name => {
    if (!records.has(name)) records.set(name, [])
    const rows = records.get(name)
    const matches = (row, query) => Object.entries(query).every(([key, value]) => value?.$in
      ? value.$in.some(candidate => String(candidate) === String(row[key])) : String(row[key]) === String(value))
    return {
      insertOne: async doc => { const saved = { ...doc, _id: new ObjectId() }; rows.push(saved); return { insertedId: saved._id } },
      insertMany: async docs => {
        const insertedIds = {}
        docs.forEach((doc, index) => { const saved = { ...doc, _id: new ObjectId() }; rows.push(saved); insertedIds[index] = saved._id })
        return { insertedCount: docs.length, insertedIds }
      },
      findOne: async query => rows.find(row => matches(row, query)) ?? null,
      find: query => ({ toArray: async () => rows.filter(row => matches(row, query)) }),
      countDocuments: async () => rows.length,
    }
  }
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: {
      collection, listCollections: () => ({ toArray: async () => [{ name: "products" }, { name: "categories" }] }),
    } }) },
    "@/lib/auth": {
      requireAdmin: async () => ({ ok: true, user: { id: "admin", role: "admin" } }),
      requireVendor: async () => ({ ok: true, user: { id: "vendor", role: "vendor" } }),
    },
  })
  return { loader, records }
}

test("shared single and bulk product creation store the approved 18 percent without modifying inputs", async () => {
  const f = fixture(), service = f.loader.load("lib/db-service.ts")
  const input = { name: "Fixture product", price: 100, stock: 3 }
  const created = await service.create("products", input)
  assert.equal(created.gstRate, 18)
  assert.equal(created.price, 100)
  assert.equal(created.stock, 3)
  assert.equal(input.gstRate, undefined)
  const batch = [{ name: "Other item" }, { name: "Imported item", gstRate: 5 }]
  const before = JSON.stringify(batch)
  await service.insertMany("products", batch)
  assert.ok(f.records.get("products").every(row => row.gstRate === 18))
  assert.equal(JSON.stringify(batch), before)
})

test("generic writes to other collections do not receive or replace product GST fields", async () => {
  const f = fixture(), service = f.loader.load("lib/db-service.ts")
  const user = await service.create("users", { name: "Fixture user" })
  assert.equal(Object.hasOwn(user, "gstRate"), false)
  await service.insertMany("orders", [{ orderId: "fixture", gstRate: 5 }])
  assert.equal(f.records.get("orders")[0].gstRate, 5)
})

for (const path of ["app/api/products/route.ts", "app/api/vendor/products/route.ts"]) {
  test(`${path} stores GST automatically when the form does not provide it`, async () => {
    const f = fixture()
    const response = await f.loader.load(path).POST(new Request("https://fixture.invalid/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Fixture smartphone blue", description: "Synthetic product description", price: 100, stock: 3, sku: "FIX-1" }),
    }))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).product.gstRate, 18)
    const saved = f.records.get("products")[0]
    const report = f.loader.load("lib/catalogue-quality.ts").auditCatalogue([{ ...saved, id: String(saved._id) }], [])
    assert.equal(report.products[0].issues.some(issue => issue.code === "gst-needs-review"), false)
  })
}

test("Excel import persists GST 18 even when the workbook has no GST column", async () => {
  const f = fixture(), workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
    itemno: "FIX-EXCEL", Name: "Fixture phone 8GB Blue", Description: "Synthetic description",
    "Category/Group Name": "Phones", "sub-category/PROD DESC": "Smartphones", "CHAR DESC": "8GB", "Manufacturer Name": "Fixture",
    "In Stock": 2, Price: 100, MRP: 150,
  }]), "Products")
  const body = new FormData()
  body.set("file", new Blob([XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })]), "products.xlsx")
  const response = await f.loader.load("app/api/products/upload-excel/route.ts").POST(new Request("https://fixture.invalid/api/products/upload-excel", { method: "POST", body }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).inserted, 1)
  assert.equal(f.records.get("products")[0].gstRate, 18)
})
