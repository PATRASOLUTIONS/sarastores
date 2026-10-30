import test from "node:test"
import assert from "node:assert/strict"
import * as XLSX from "xlsx"
import { sourceLoader } from "./source-loader.mjs"

const columns = ["itemno", "name", "division", "segment", "brand", "price", "mrp", "overall stock", "status"]
function fixture(products = [], stock = []) {
  let authorized = false
  const reads = []
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: new Response("Forbidden", { status: 403 }) } },
    "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products" }, getCollection: async name => {
      reads.push(name)
      return { find: filter => {
        assert.deepEqual(Object.keys(filter), [])
        return { sort() { return this }, toArray: async () => name === "products" ? products : stock }
      } }
    } },
  }).load("app/api/products/export/route.ts")
  return { route, reads, authorize: () => { authorized = true } }
}
async function workbook(fx) {
  fx.authorize()
  const response = await fx.route.GET()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.ok(!response.headers.get("Content-Disposition").includes(":"))
  return XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" })
}

test("product export guards database access and writes the requested two sheets with linked item numbers", async () => {
  const fx = fixture([
    { _id: "p1", itemno: "000123", sku: "SKU-A", name: "Laptop", division: "Computers", segment: "Gaming", brand: "Brand A", price: 50, mrp: 100, stock: 8, active: true },
    { _id: "p2", raw: { "Item No.": "000456", Name: "Legacy", Division: "Home", Segment: "Kitchen", Brand: "Brand B", MRP: 0 }, price: 0, stock: 0, active: false },
    { _id: "p3", sku: "NO-STORES", name: "No stores", stock: 7 },
  ], [
    { sku: "SKU-A", storeCode: "007", quantity: 5 },
    { sku: "sku-a", storeCode: "008", quantity: 3 },
    { sku: "000456", storeCode: "007", quantity: 0 },
    { sku: "UNKNOWN", storeCode: "007", quantity: 100 },
  ])
  assert.equal((await fx.route.GET()).status, 403)
  assert.equal(fx.reads.length, 0)
  const book = await workbook(fx)
  assert.deepEqual(book.SheetNames, ["Products", "Store Stock"])
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets.Products, { header: 1 })[0], columns)
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets["Store Stock"], { header: 1 })[0], ["itemno", "stock", "storecode"])
  const rows = XLSX.utils.sheet_to_json(book.Sheets.Products)
  assert.deepEqual(rows[0], { itemno: "000123", name: "Laptop", division: "Computers", segment: "Gaming", brand: "Brand A", price: 50, mrp: 100, "overall stock": 8, status: "Active" })
  assert.equal(rows[1].status, "Inactive")
  assert.equal(rows[1].mrp, 0)
  assert.equal(rows[2]["overall stock"], 7)
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets["Store Stock"]), [
    { itemno: "000123", stock: 5, storecode: "007" },
    { itemno: "000123", stock: 3, storecode: "008" },
    { itemno: "000456", stock: 0, storecode: "007" },
  ])
  assert.equal(book.Sheets.Products.A2.t, "s")
  assert.equal(book.Sheets["Store Stock"].C2.t, "s")
})

test("empty product exports retain both sheet headers", async () => {
  const book = await workbook(fixture())
  assert.deepEqual(book.SheetNames, ["Products", "Store Stock"])
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets.Products, { header: 1 }), [columns])
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets["Store Stock"], { header: 1 }), [["itemno", "stock", "storecode"]])
})

test("product exports include all 18,000 products and their stock rows", async () => {
  const products = Array.from({ length: 18000 }, (_, index) => ({ _id: `p${index}`, itemno: `ITEM${index}`, name: `Product ${index}`, stock: index % 5, active: index % 2 === 0 }))
  const stock = products.map(product => ({ sku: product.itemno, storeCode: "007", quantity: product.stock }))
  const book = await workbook(fixture(products, stock))
  const summaries = XLSX.utils.sheet_to_json(book.Sheets.Products)
  const stores = XLSX.utils.sheet_to_json(book.Sheets["Store Stock"])
  assert.equal(summaries.length, 18000)
  assert.equal(stores.length, 18000)
  assert.equal(summaries.at(-1).itemno, "ITEM17999")
  assert.equal(stores.at(-1).itemno, "ITEM17999")
})
