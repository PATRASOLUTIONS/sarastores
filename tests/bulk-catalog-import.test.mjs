import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { ObjectId } from "mongodb"
import * as XLSX from "xlsx"
import { sourceLoader } from "./source-loader.mjs"

const row = {
  itemno: "FIXTURE-001", name: "Uploaded name", category: "Uploaded category",
  subCategory: "Uploaded sub category", charDesc: "Uploaded characteristic",
  brand: "Uploaded brand", url: "https://www.lg.com/in/example",
}
function productFixture() {
  return {
    ...sourceLoader().load("lib/scrapers/types.ts").emptyProduct("lg", row.url),
    sap: { sku: "", name: "Scraped name", category: "", subCategory: "", brand: "Scraped brand", charDesc: "", price: 80 },
    mrp: 100, images: ["https://www.lg.com/gallery.jpg"],
    manufacturerImages: ["https://www.lg.com/marketing.jpg"],
    technicalDetails: { Capacity: "200 litres" },
    description: "Scraped description", features: ["Fixture feature"],
  }
}

test("scraper Excel template round-trips with all requested columns", () => {
  const { SCRAPER_TEMPLATE, parseScraperRows } = sourceLoader().load("lib/scrapers/bulk-import.ts")
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(SCRAPER_TEMPLATE), "Scraper")
  const read = XLSX.read(XLSX.write(book, { type: "array", bookType: "xlsx" }), { type: "array" })
  const parsed = parseScraperRows(XLSX.utils.sheet_to_json(read.Sheets.Scraper))
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].subCategory, "Double Door")
  assert.equal(parsed[0].charDesc, "Example model")
  assert.equal(parsed[0].itemno, "REFSAM1187")
})

test("flipkart short links are accepted from plain cells, bare hosts and excel hyperlinks", async () => {
  const { validateScraperRows, normalizeScraperUrl } = sourceLoader().load("lib/scrapers/bulk-import.ts")
  const supported = url => /(^|\.)flipkart\.com$|fkrt\.it$/.test(new URL(url).hostname.replace(/^www\./, ""))
  const link = "https://dl.flipkart.com/s/ZunNveuuuN"
  const direct = validateScraperRows([{ ...row, "product link": link }], supported)
  assert.equal(direct.issues.length, 0)
  assert.equal(direct.rows[0].url, link)
  const bare = validateScraperRows([{ ...row, "product link": "dl.flipkart.com/s/ZunNveuuuN" }], supported)
  assert.equal(bare.rows[0].url, link)
  assert.equal(normalizeScraperUrl('=HYPERLINK("https://dl.flipkart.com/s/ZunNveuuuN","Open")'), link)

  const queue = queueHarness(async () => { throw new Error("Upload must not scrape") }, supported)
  await queue.upload({
    rows: [{ ...row, itemno: "FK1", "product link": "Open" }],
    hyperlink: link,
  })
  assert.equal(queue.error(), "")
  assert.equal(queue.items()[0].row.url, link)
})

test("scraper rows validate required metadata, aliases, duplicates and exact 500-row limit", () => {
  const { parseScraperRows } = sourceLoader().load("lib/scrapers/bulk-import.ts")
  assert.equal(parseScraperRows([{ ...row, "product link": row.url }])[0].url, row.url)
  assert.equal(parseScraperRows([{ ...row, charDesc: "" }])[0].charDesc, "")
  for (const field of ["itemno", "name", "category", "subCategory", "brand", "url"]) {
    assert.throws(() => parseScraperRows([{ ...row, [field]: "" }]), /Row 2/)
  }
  assert.throws(() => parseScraperRows([row, { ...row, itemno: row.itemno.toLowerCase() }]), /duplicate itemno/)
  assert.throws(() => parseScraperRows([]), /between 1 and 500/)
  const rows = Array.from({ length: 500 }, (_, i) => ({ ...row, itemno: `ITEM${i}` }))
  assert.equal(parseScraperRows(rows).length, 500)
  assert.throws(() => parseScraperRows([...rows, { ...row, itemno: "EXTRA" }]), /between 1 and 500/)
})

function publishingFixture({ initial = [], locked = false, failSpec = false, rollback = false } = {}) {
  let products = initial.map(value => ({ ...value }))
  let specs = locked ? [{ sku: row.itemno, locked: true }] : []
  let sessionsEnded = 0
  let transactions = 0
  const options = []
  const session = {
    withTransaction: async callback => {
      transactions++
      const before = { products: [...products], specs: [...specs] }
      try {
        const value = await callback()
        if (rollback) throw new Error("Fixture commit failure")
        return value
      } catch (error) {
        products = before.products
        specs = before.specs
        throw error
      }
    },
    endSession: async () => { sessionsEnded++ },
  }
  const collections = {
    products: {
      find: (query, opts) => {
        options.push(opts)
        assert.equal(query.$or[0].itemno, row.itemno)
        return { limit: () => ({ toArray: async () => products }) }
      },
      insertOne: async (doc, opts) => { options.push(opts); products = [...products, doc]; return { insertedId: doc._id } },
      updateOne: async (filter, update, opts) => {
        options.push(opts)
        products = products.map(doc => doc._id.equals(filter._id) ? { ...doc, ...update.$set } : doc)
        return { matchedCount: 1 }
      },
    },
    product_specifications: {
      createIndex: async (keys, opts) => { assert.equal(keys.sku, 1); assert.equal(opts.unique, true) },
      findOne: async (_, opts) => { options.push(opts); return specs[0] },
      updateOne: async (filter, update, opts) => {
        options.push(opts)
        assert.equal(filter.locked.$ne, true)
        if (failSpec) throw new Error("Fixture spec write failure")
        specs = [{ ...update.$set }]
        return { acknowledged: true, matchedCount: 0, upsertedId: new ObjectId() }
      },
    },
  }
  const loader = sourceLoader({
    "@/lib/db-service": {
      getCollection: async name => collections[name],
      normalizeId: doc => ({ id: doc._id.toString(), slug: doc.slug, name: doc.name }),
    },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client: { startSession: () => session } }) },
  })
  return {
    publish: loader.load("lib/scrapers/publish.ts").publishScrapedProduct,
    state: () => ({ products, specs, sessionsEnded, transactions, options, session }),
  }
}

test("publishing atomically creates canonical product and approved, reachable specifications", async () => {
  const fixture = publishingFixture()
  const saved = await fixture.publish(row, productFixture())
  const { products, specs, sessionsEnded, options, session } = fixture.state()
  assert.equal(products.length, 1)
  assert.equal(specs.length, 1)
  const product = products[0]
  assert.equal(saved.id, product._id.toString())
  assert.ok(saved.slug.endsWith(saved.id))
  for (const [field, value] of Object.entries({
    name: row.name, category: row.category, subCategory: row.subCategory,
    brand: row.brand, manufacturerName: row.brand, char_desc: row.charDesc,
    itemno: row.itemno, sku: row.itemno, active: true, stock: 0, price: 80, mrp: 100,
  })) assert.equal(product[field], value, field)
  assert.equal(product.raw["Category/Group Name"], row.category)
  assert.equal(product.raw["CHAR DESC"], row.charDesc)
  assert.equal(specs[0].product_id, saved.id)
  assert.equal(specs[0].isSynced, true)
  assert.equal(specs[0].name, row.name)
  assert.equal(specs[0].technical_details.Capacity, "200 litres")
  assert.deepEqual(Array.from(specs[0].specification_images), [...productFixture().images, ...productFixture().manufacturerImages])
  assert.equal(sessionsEnded, 1)
  assert.ok(options.every(opts => opts.session === session))
})

test("retries update same product and preserve selling price, MRP, stock and slug", async () => {
  const fixture = publishingFixture({ initial: [{
    _id: new ObjectId(), itemno: row.itemno, price: 60, mrp: 120,
    stock: 7, slug: "existing-slug", raw: { "CHAR DESC": "Old" },
  }] })
  await fixture.publish({ ...row, charDesc: "" }, productFixture())
  await fixture.publish({ ...row, charDesc: "" }, productFixture())
  const { products, specs } = fixture.state()
  assert.equal(products.length, 1)
  assert.equal(specs.length, 1)
  assert.equal(products[0].price, 60)
  assert.equal(products[0].mrp, 120)
  assert.equal(products[0].stock, 7)
  assert.equal(products[0].slug, "existing-slug")
  assert.equal(products[0].raw["CHAR DESC"], "")
})

test("missing source price does not invent stock or fail an otherwise usable specification", async () => {
  const fixture = publishingFixture()
  const product = productFixture()
  product.sap.price = null
  product.mrp = null
  await fixture.publish(row, product)
  assert.equal(fixture.state().products[0].stock, 0)
  assert.equal(fixture.state().products[0].price, 0)
})

test("locked/ambiguous products fail before mutation and all failures end sessions", async () => {
  for (const options of [
    { locked: true },
    { initial: [{ _id: new ObjectId() }, { _id: new ObjectId() }] },
    { initial: [{ _id: new ObjectId(), price: 150, mrp: 100 }] },
  ]) {
    const fixture = publishingFixture(options)
    await assert.rejects(fixture.publish(row, productFixture()), /locked|Multiple products|Price exceeds/)
    assert.equal(fixture.state().sessionsEnded, 1)
    assert.equal(fixture.state().products.length, options.initial?.length ?? 0)
  }
})

test("specification failure or transaction commit failure leaves neither partial product nor partial approval", async () => {
  for (const options of [{ failSpec: true }, { rollback: true }]) {
    const fixture = publishingFixture(options)
    await assert.rejects(fixture.publish(row, productFixture()), /Fixture/)
    assert.equal(fixture.state().products.length, 0)
    assert.equal(fixture.state().specs.length, 0)
    assert.equal(fixture.state().sessionsEnded, 1)
  }
})

test("publish API guards first, validates source/payload and reports concurrent saves truthfully", async () => {
  let authorized = false, calls = 0, fail = false
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) } },
    "@/lib/scrapers/publish": { publishScrapedProduct: async () => {
      calls++
      if (fail) throw { code: 11000 }
      return { id: "fixture", slug: "fixture-product" }
    } },
  })
  const route = loader.load("app/api/scrape/publish/route.ts")
  const post = payload => route.POST(new Request("https://fixture.invalid/api/scrape/publish", { method: "POST", body: typeof payload === "string" ? payload : JSON.stringify(payload) }))
  const payload = { row, product: productFixture() }
  assert.equal((await post(payload)).status, 401)
  assert.equal(calls, 0)
  authorized = true
  for (const invalid of [
    "{", {}, { ...payload, row: { ...row, name: "" } },
    { ...payload, row: { ...row, url: "https://127.0.0.1/private" } },
    { ...payload, row: { ...row, url: "https://amazon.in/dp/TEST" } },
    { ...payload, product: { ...payload.product, images: ["javascript:alert(1)"] } },
  ]) assert.equal((await post(invalid)).status, 400)
  assert.equal(calls, 0)
  assert.equal((await (await post(payload)).json()).success, true)
  fail = true
  assert.equal((await post(payload)).status, 409)
})

function priceFixture(products) {
  const writes = []
  const loader = sourceLoader({ "@/lib/db-service": { getCollection: async () => ({
    find: () => ({ toArray: async () => products }),
    findOneAndUpdate: async (filter, update) => { writes.push({ filter, update }); return update.$set },
  }) } })
  return { process: loader.load("lib/product-price-import.ts").processProductPrices, writes }
}

test("price importer previews and atomically writes all four columns, including zero stock and higher MRP", async () => {
  const id = new ObjectId()
  const fixture = priceFixture([{ _id: id, itemno: "A", price: 50, mrp: 100, stock: 5 }])
  const rows = [{ itemno: "A", price: 150, mrp: 200, stock: 0 }]
  const preview = await fixture.process(rows, true)
  assert.equal(preview.updates[0].status, "valid")
  assert.equal(preview.updates[0].mrp, 100)
  assert.equal(preview.updates[0].newMrp, 200)
  assert.equal(preview.updates[0].oldStock, 5)
  assert.equal(preview.updates[0].newStock, 0)
  assert.equal(fixture.writes.length, 0)
  assert.equal((await fixture.process(rows, false)).success, 1)
  assert.equal(fixture.writes.length, 1)
  const { filter, update } = fixture.writes[0]
  assert.equal(update.$set.price, 150)
  assert.equal(update.$set.mrp, 200)
  assert.equal(update.$set.stock, 0)
  assert.equal(filter.mrp, 100)
  assert.equal(filter.price, 50)
  assert.equal(filter.stock, 5)
})

test("legacy two-column and blank optional price imports preserve MRP and stock", async () => {
  const fixture = priceFixture([{ _id: new ObjectId(), sku: "A", price: 20, mrp: 100, stock: 7 }])
  const result = await fixture.process([{ itemno: "A", price: "₹ 60", mrp: " ", stock: "" }], false)
  assert.equal(result.success, 1)
  assert.equal(Object.hasOwn(fixture.writes[0].update.$set, "stock"), false)
  assert.equal(Object.hasOwn(fixture.writes[0].update.$set, "mrp"), false)
})

test("invalid MRP/stock rejects entire row without partial price update", async () => {
  for (const values of [
    { mrp: 30 }, { mrp: -1 }, { mrp: Infinity }, { mrp: true }, { mrp: "80junk" },
    { stock: -1 }, { stock: 1.5 }, { stock: Infinity }, { stock: true }, { stock: 1000001 }, { stock: "1junk" },
  ]) {
    const fixture = priceFixture([{ _id: new ObjectId(), itemno: "A", price: 20, mrp: 100, stock: 7 }])
    const rows = [{ itemno: "A", price: 50, ...values }]
    assert.equal((await fixture.process(rows, true)).updates[0].status, "error")
    assert.equal((await fixture.process(rows, false)).failed, 1)
    assert.equal(fixture.writes.length, 0)
  }
})

test("price importer matches secondary SKU, rejects ambiguous matches and supports decreasing MRP", async () => {
  const fixture = priceFixture([{ _id: new ObjectId(), itemno: "A", sku: "B", price: 100, mrp: 200, stock: 5 }])
  assert.equal((await fixture.process([{ itemno: "B", price: 50, mrp: 60, stock: "2" }], false)).success, 1)
  const ambiguous = priceFixture([{ _id: new ObjectId(), itemno: "A" }, { _id: new ObjectId(), sku: "A" }])
  assert.equal((await ambiguous.process([{ itemno: "A", price: 50 }], false)).failed, 1)
  assert.equal(ambiguous.writes.length, 0)
})

test("bulk UI wires supported-source scraping, queued publish, progress, retries, stop and templates", () => {
  const source = fs.readFileSync(new URL("../components/admin/BulkScraperImport.tsx", import.meta.url), "utf8")
  for (const required of ["SCRAPER_TEMPLATE", "validateScraperRows", "fetchProduct(items[i].row.url)", "/api/scrape/publish", 'items[i].status === "success"', 'update(i, "error"', "stop.current", "inFlight.current", "beforeunload", "Go to Products"]) {
    assert.ok(source.includes(required), required)
  }
  const page = fs.readFileSync(new URL("../app/admin/scraper/page.tsx", import.meta.url), "utf8")
  assert.ok(page.includes("<BulkScraperImport"))
  assert.ok(page.includes("saveToDatabase: false"))
  const prices = fs.readFileSync(new URL("../app/admin/products/page.tsx", import.meta.url), "utf8")
  assert.ok(prices.includes("active-products-price-mrp-stock.xlsx"))
  assert.ok(prices.includes("item.newStock"))
  assert.ok(prices.includes("item.newMrp"))
  assert.ok(prices.includes("item.newActive"))
})

function queueHarness(fetchProduct, supportedUrl = () => true) {
  const state = []
  let cursor = 0
  const published = []
  const publishedRows = []
  const navigation = []
  const loader = sourceLoader({
    react: {
      useState: initial => {
        const index = cursor++
        if (!(index in state)) state[index] = initial
        return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value }]
      },
      useRef: initial => {
        const index = cursor++
        if (!(index in state)) state[index] = { current: initial }
        return state[index]
      },
      useEffect: () => {},
      useMemo: callback => callback(),
    },
    "@/components/ui/dialog": { Dialog: "dialog", DialogContent: "div", DialogHeader: "header", DialogTitle: "h2", DialogDescription: "p" },
    "@/lib/api-client": { apiFetch: async (url, options) => {
      assert.equal(url, "/api/scrape/publish")
      published.push(options.json.row.itemno)
      publishedRows.push(options.json.row)
      return Response.json({ success: true })
    } },
    "next/navigation": { useRouter: () => ({ push: path => navigation.push(path) }) },
    "react-hot-toast": { toast: { error: message => { throw new Error(message) }, success: () => {} } },
  }, { context: { window: { confirm: () => true } } })
  const Component = loader.load("components/admin/BulkScraperImport.tsx").default
  const render = () => { cursor = 0; return Component({ fetchProduct, supportedUrl }) }
  const elements = node => {
    if (node == null || typeof node !== "object") return []
    if (Array.isArray(node)) return node.flatMap(elements)
    return [node, ...elements(node.props?.children)]
  }
  const button = text => elements(render()).find(element => element.type === "button" && element.props.children === text)
  const upload = async (options = {}) => {
    const sheetRows = options.rows || ["A", "B", "C"].map(itemno => ({ ...row, itemno, "product link": row.url }))
    const book = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(sheetRows)
    if (options.formatItemno) sheet.A2.z = "0000"
    if (options.blankRow) {
      const lastColumn = XLSX.utils.decode_range(sheet["!ref"]).e.c
      for (let column = 0; column <= lastColumn; column++) delete sheet[XLSX.utils.encode_cell({ r: 2, c: column })]
      XLSX.utils.sheet_add_json(sheet, [sheetRows[1]], { origin: "A4", skipHeader: true })
    }
    if (options.sparseExtra) XLSX.utils.sheet_add_json(sheet, [{ ...row, itemno: "EXTRA" }], { origin: "A1000", skipHeader: true })
    if (options.hyperlink) {
      const range = XLSX.utils.decode_range(sheet["!ref"])
      let linkColumn = range.s.c
      for (let column = range.s.c; column <= range.e.c; column++) {
        const header = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })]
        if (header?.v === "product link") linkColumn = column
      }
      const address = XLSX.utils.encode_cell({ r: range.s.r + 1, c: linkColumn })
      sheet[address].v = "Open"
      sheet[address].w = "Open"
      sheet[address].l = { Target: options.hyperlink }
    }
    XLSX.utils.book_append_sheet(book, sheet, "Scraper")
    const array = XLSX.write(book, { type: "array", bookType: "xlsx" })
    const input = elements(render()).find(element => element.type === "input")
    input.props.onChange({ target: { files: [{ name: "fixture.xlsx", size: array.byteLength, arrayBuffer: async () => array }], value: "fixture.xlsx" } })
    for (let i = 0; i < 30 && state[2]; i++) await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(state[2], false, "upload finished")
    if (!options.expectError) assert.equal(state[0].length, sheetRows.length)
  }
  const field = label => elements(render()).find(element => element.type === "textarea" && element.props["aria-label"] === label)
  return {
    upload, button, field, items: () => state[0], error: () => state[5], published, publishedRows, navigation,
    elements: () => elements(render()),
    editorOpen: () => elements(render()).some(element => element.type === "dialog" && element.props.open),
  }
}

test("actual queue processes every uploaded row, continues after failure and retries only failed rows", async () => {
  let calls = 0
  const queue = queueHarness(async () => {
    calls++
    if (calls === 2) throw new Error("Fixture retailer unavailable")
    return productFixture()
  })
  await queue.upload()
  await queue.button("Run Scraper").props.onClick()
  assert.deepEqual(Array.from(queue.items(), item => item.status), ["success", "error", "success"])
  assert.deepEqual(queue.published, ["A", "C"])
  assert.deepEqual(queue.navigation, [])
  assert.match(queue.items()[1].message, /retailer unavailable/)
  await queue.button("Retry failed / run pending").props.onClick()
  assert.equal(calls, 4)
  assert.deepEqual(queue.published, ["A", "C", "B"])
  assert.ok(queue.items().every(item => item.status === "success"))
  assert.deepEqual(queue.navigation, ["/admin/products"])
})

test("actual queue stop waits for current row and a second run resumes pending rows without duplicates", async () => {
  let calls = 0, queue
  queue = queueHarness(async () => {
    calls++
    if (calls === 1) queue.button("Stop after current item").props.onClick()
    return productFixture()
  })
  await queue.upload()
  await queue.button("Run Scraper").props.onClick()
  assert.deepEqual(Array.from(queue.items(), item => item.status), ["success", "pending", "pending"])
  assert.deepEqual(queue.navigation, [])
  await queue.button("Run Scraper").props.onClick()
  assert.deepEqual(queue.published, ["A", "B", "C"])
  assert.deepEqual(queue.navigation, ["/admin/products"])
})

test("actual Excel upload accepts 500 rows but rejects truncated sheets instead of silently losing later items", async () => {
  const queue = queueHarness(async () => { throw new Error("Upload must not scrape") })
  const rows = Array.from({ length: 500 }, (_, index) => ({ ...row, itemno: `ITEM${index}` }))
  await queue.upload({ rows })
  assert.equal(queue.items().length, 500)
  await queue.upload({ rows, sparseExtra: true, expectError: true })
  assert.equal(queue.items().length, 0)
  assert.match(queue.error(), /exceeds 500 rows/)
  assert.deepEqual(queue.published, [])
})

test("invalid Row 3 opens full editable Excel data and corrected cells populate the queue without reuploading", async () => {
  let fetches = 0
  const queue = queueHarness(async () => { fetches++; return productFixture() }, url => url.startsWith("https://www.lg.com/"))
  const unsupported = "https://unsupported.example/products/exact-model?colour=white&size=large"
  const rows = ["A", "B", "C"].map((itemno, index) => ({
    itemno, name: `Original ${itemno}`, category: "Refrigerators", "sub category": "Double Door",
    "char desc": `Characteristic ${itemno}`, brand: "LG",
    "product link": index === 1 ? unsupported : row.url,
    "Extra spreadsheet note": `Unmapped original data ${itemno}`,
  }))
  await queue.upload({ rows, expectError: true })
  assert.equal(queue.editorOpen(), true)
  assert.equal(queue.items().length, 0)
  assert.equal(queue.button("Run Scraper").props.disabled, true)
  const invalid = queue.field("Row 3, product link")
  assert.equal(invalid.props.value, unsupported)
  assert.equal(invalid.props["aria-invalid"], true)
  assert.match(queue.error(), /Row 3: Unsupported product link/)
  for (let index = 0; index < rows.length; index++) {
    for (const [column, value] of Object.entries(rows[index])) {
      assert.equal(queue.field(`Row ${index + 2}, ${column}`).props.value, value)
    }
  }
  assert.equal(fetches, 0)
  invalid.props.onChange({ target: { value: "https://www.lg.com/in/corrected" } })
  queue.field("Row 3, name").props.onChange({ target: { value: "Corrected name" } })
  assert.equal(queue.field("Row 3, product link").props["aria-invalid"], false)
  queue.button("Validate & use sheet").props.onClick()
  assert.equal(queue.editorOpen(), false)
  assert.equal(queue.items().length, 3)
  assert.equal(queue.items()[1].row.name, "Corrected name")
  assert.equal(queue.items()[1].row.url, "https://www.lg.com/in/corrected")
  assert.equal(fetches, 0)
  await queue.button("Run Scraper").props.onClick()
  assert.equal(fetches, 3)
  assert.equal(queue.publishedRows[1].name, "Corrected name")
  assert.equal(queue.publishedRows[1].url, "https://www.lg.com/in/corrected")
})

test("editor shows all issues, opens first invalid page and preserves drafts when closed and reopened", async () => {
  const queue = queueHarness(async () => { throw new Error("Must not scrape invalid data") }, url => url.startsWith("https://www.lg.com/"))
  const rows = Array.from({ length: 55 }, (_, index) => ({
    ...row, itemno: `ITEM${index}`, "product link": index === 30 ? "https://unsupported.example/item" : row.url,
    brand: index === 45 ? "" : row.brand,
  }))
  rows[45].itemno = rows[30].itemno
  await queue.upload({ rows, expectError: true })
  assert.equal(queue.editorOpen(), true)
  assert.ok(queue.field("Row 32, product link"))
  assert.equal(queue.field("Row 2, name"), undefined)
  assert.equal(queue.field("Row 47, brand").props["aria-invalid"], true)
  queue.field("Row 32, product link").props.onChange({ target: { value: row.url } })
  queue.button("Validate & use sheet").props.onClick()
  assert.equal(queue.editorOpen(), true)
  assert.equal(queue.items().length, 0)
  queue.button("Close editor").props.onClick()
  assert.equal(queue.editorOpen(), false)
  assert.equal(queue.button("Run Scraper").props.disabled, true)
  queue.button("Edit uploaded sheet").props.onClick()
  assert.equal(queue.field("Row 32, product link").props.value, row.url)
  assert.equal(queue.field("Row 32, url").props["aria-invalid"], false)
  queue.field("Row 47, brand").props.onChange({ target: { value: "LG" } })
  queue.field("Row 47, itemno").props.onChange({ target: { value: "CORRECTED-UNIQUE" } })
  queue.button("Previous sheet page").props.onClick()
  assert.ok(queue.field("Row 2, name"))
  queue.button("Next sheet page").props.onClick()
  queue.button("Next sheet page").props.onClick()
  assert.ok(queue.field("Row 56, name"))
  queue.button("Validate & use sheet").props.onClick()
  assert.equal(queue.editorOpen(), false)
  assert.equal(queue.items().length, 55)
})

test("missing columns become editable blanks and changing a valid sheet invalidates its old queue", async () => {
  const queue = queueHarness(async () => productFixture())
  const { brand, ...withoutBrand } = row
  assert.ok(brand)
  await queue.upload({ rows: [withoutBrand], expectError: true })
  assert.equal(queue.field("Row 2, brand").props.value, "")
  assert.equal(queue.field("Row 2, brand").props["aria-invalid"], true)
  queue.field("Row 2, brand").props.onChange({ target: { value: "LG" } })
  queue.button("Validate & use sheet").props.onClick()
  assert.equal(queue.items().length, 1)
  queue.button("Edit uploaded sheet").props.onClick()
  queue.field("Row 2, name").props.onChange({ target: { value: "" } })
  assert.equal(queue.items().length, 0)
  queue.button("Validate & use sheet").props.onClick()
  assert.equal(queue.editorOpen(), true)
  assert.equal(queue.field("Row 2, name").props["aria-invalid"], true)
})

test("sheet editor retains original Excel row numbers across gaps and formatted leading-zero item numbers", async () => {
  const queue = queueHarness(async () => productFixture(), url => !url.includes("unsupported"))
  const rows = [
    { ...row, itemno: 1 },
    { ...row, itemno: "B", url: "https://unsupported.example/item" },
  ]
  await queue.upload({ rows, formatItemno: true, blankRow: true, expectError: true })
  assert.equal(queue.field("Row 2, itemno").props.value, "0001")
  assert.equal(queue.field("Row 4, url").props.value, rows[1].url)
  assert.equal(queue.field("Row 4, url").props["aria-invalid"], true)
  assert.equal(queue.field("Row 3, url"), undefined)
})

test("shared validator reports every row and field without changing uploaded values or accepting unknown columns as aliases", () => {
  const { validateScraperRows, scraperColumnField } = sourceLoader().load("lib/scrapers/bulk-import.ts")
  const data = [
    { ...row, name: "", url: "https://unsupported.example/path" },
    { ...row, itemno: row.itemno.toLowerCase(), brand: "" },
  ]
  const copy = JSON.stringify(data)
  const result = validateScraperRows(data, url => !url.includes("unsupported"), [3, 7])
  assert.equal(JSON.stringify(data), copy)
  assert.equal(result.issues.length, 4)
  assert.equal(result.issues.filter(issue => issue.row === 3).length, 2)
  assert.equal(result.issues.filter(issue => issue.row === 7).length, 2)
  assert.equal(scraperColumnField("Product-Link"), "url")
  assert.equal(scraperColumnField("constructor"), undefined)
})

function adminCatalogFixture(records, { authorized = true, fullAdmin = true, failRead = false, failCount = false } = {}) {
  const { normalizeId } = sourceLoader().load("lib/db-service.ts")
  const requests = []
  const queries = []
  let guardCalls = 0
  let connections = 0
  const matching = filter => records.filter(product => filter.active === undefined || product.active === filter.active)
  const collection = {
    find: (filter, options) => {
      let skip = 0, limit = 0, ordered
      queries.push({ filter, options })
      const cursor = {
        sort: sort => {
          assert.equal(sort._id, 1)
          ordered = [...matching(filter)].sort((a, b) => a._id.toString().localeCompare(b._id.toString()))
          return cursor
        },
        skip: value => { skip = value; return cursor },
        limit: value => { limit = value; return cursor },
        toArray: async () => {
          if (failRead) throw new Error("Fixture catalogue read failed")
          return (ordered || matching(filter)).slice(skip, skip + limit).map(product => {
            if (!options.projection) return product
            const projected = { _id: product._id }
            for (const [field, value] of Object.entries(options.projection)) {
              if (product[field] === undefined) continue
              projected[field] = typeof value === "object" ? product[field].slice(0, value.$slice) : product[field]
            }
            return projected
          })
        },
      }
      return cursor
    },
    countDocuments: async filter => {
      if (failCount) throw new Error("Fixture catalogue count failed")
      return matching(filter).length
    },
  }
  const loader = sourceLoader({
    "@/lib/auth": {
      isAdmin: async () => fullAdmin,
      requireAdmin: async () => {
        guardCalls++
        return authorized ? { ok: true, userId: "fixture-admin" } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) }
      },
    },
    "@/lib/mongodb": { connectToDatabase: async () => { connections++; return {} } },
    "@/lib/db-service": {
      COLLECTIONS: { PRODUCTS: "products" }, normalizeId,
      getCollection: async () => collection,
      getAll: async (_, filter, options) => normalizeId(matching(filter).slice(options.skip, options.skip + options.limit)),
      count: async (_, filter) => matching(filter).length,
    },
  })
  const route = loader.load("app/api/products/route.ts")
  const client = sourceLoader({
    "@/lib/api-client": { apiFetch: async (url, options) => {
      requests.push(url)
      assert.equal(options.cache, "no-store")
      return route.GET(new Request(`https://fixture.invalid${url}`))
    } },
  }).load("lib/admin-products-client.ts")
  return { route, client, requests, queries, guardCalls: () => guardCalls, connections: () => connections }
}

test("newly scraped product beyond the old 500-row list is visible through complete paged admin loading", async () => {
  const records = Array.from({ length: 1205 }, (_, index) => ({
    _id: new ObjectId(), itemno: `EXISTING-${index}`, sku: `EXISTING-${index}`,
    name: `Existing ${index}`, price: 50, mrp: 100, stock: 5,
    active: index % 2 === 0,
    images: ["https://fixture.invalid/primary.jpg", "https://fixture.invalid/secondary.jpg"],
    description: "Metadata description", technicalDetails: { Large: "Enrichment" },
    raw: { "Item No.": `EXISTING-${index}`, "ITEM CATEGORY": "Legacy category" },
  }))
  const published = publishingFixture()
  const saved = await published.publish(row, productFixture())
  records.push(published.state().products[0])
  const fixture = adminCatalogFixture(records)
  const legacy = await fixture.route.GET(new Request("https://fixture.invalid/api/products?include_inactive=true"))
  const oldList = await legacy.json()
  assert.equal(oldList.length, 500, "reproduces the previous admin page's truncated request")
  assert.equal(oldList.some(product => product.id === saved.id), false)
  const first = fixture.client.fetchAllAdminProducts()
  const second = fixture.client.fetchAllAdminProducts()
  assert.equal(first, second, "category extraction and table loading share the same in-flight read")
  const all = await first
  assert.equal(all.length, 1206)
  const product = all.find(item => item.id === saved.id)
  assert.equal(product.name, row.name)
  assert.equal(product.category, row.category)
  assert.equal(product.stock, 0)
  assert.ok(all.some(item => item.active === false), "inactive manual imports remain visible to staff")
  assert.equal(fixture.requests.length, 13)
  assert.equal(new URL(fixture.requests.at(-1), "https://fixture.invalid").searchParams.get("skip"), "1200")
  assert.equal(all[0].images.length, 1)
  assert.equal(all[0].technicalDetails, undefined)
  assert.equal(all[0].description, undefined)
  assert.equal(all[0].raw["ITEM CATEGORY"], "Legacy category")
  assert.ok(all.every(item => !("_id" in item)))
  assert.ok(fixture.queries.every(query => query.options.projection.raw === 1))
  const metadata = await fixture.client.fetchAllAdminProducts(true)
  assert.equal(metadata.length, 1206, "metadata template is no longer silently capped at 1,000")
  assert.equal(metadata[0].description, "Metadata description")
  assert.equal(metadata.find(item => item.id === saved.id).name, row.name)
  assert.equal(fixture.guardCalls(), 26)
})

test("admin product projections guard themselves and never enter a shared public cache", async () => {
  const records = [{ _id: new ObjectId(), name: "Inactive fixture", active: false }]
  for (const mode of ["admin", "admin-metadata"]) {
    const forbidden = adminCatalogFixture(records, { authorized: false })
    const denied = await forbidden.route.GET(new Request(`https://fixture.invalid/api/products?fields=${mode}`))
    assert.equal(denied.status, 403)
    assert.equal(forbidden.queries.length, 0)
    assert.equal(forbidden.connections(), 0)
    const fixture = adminCatalogFixture(records, { fullAdmin: false })
    const response = await fixture.route.GET(new Request(`https://fixture.invalid/api/products?fields=${mode}`))
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.equal((await response.json()).length, 1)
    assert.equal(fixture.queries[0].filter.active, undefined)
  }
})

test("public product reads retain active filtering, default/max bounds, paging headers and public cache policy", async () => {
  const records = Array.from({ length: 2500 }, (_, index) => ({
    _id: new ObjectId(), name: `Fixture ${index}`, active: index % 2 === 0,
  }))
  const fixture = adminCatalogFixture(records, { authorized: false, fullAdmin: false })
  const first = await fixture.route.GET(new Request("https://fixture.invalid/api/products?include_inactive=true"))
  const firstData = await first.json()
  assert.equal(firstData.length, 500)
  assert.ok(firstData.every(product => product.active === true))
  assert.equal(first.headers.get("X-Total-Count"), "1250")
  assert.equal(first.headers.get("X-Has-More"), "true")
  assert.match(first.headers.get("cache-control"), /^public,/)
  const bounded = await fixture.route.GET(new Request("https://fixture.invalid/api/products?limit=100000"))
  assert.equal((await bounded.json()).length, 1000)
  const remaining = await fixture.route.GET(new Request("https://fixture.invalid/api/products?skip=1000&limit=1000"))
  assert.equal((await remaining.json()).length, 250)
  assert.equal(remaining.headers.get("X-Has-More"), "false")
  assert.equal(fixture.guardCalls(), 0)
})

test("admin catalogue read/count failures are explicit errors, not an empty successful list", async () => {
  for (const options of [{ failRead: true }, { failCount: true }]) {
    const fixture = adminCatalogFixture([], options)
    const response = await fixture.route.GET(new Request("https://fixture.invalid/api/products?fields=admin"))
    assert.equal(response.status, 500)
  }
})

test("admin loader rejects incomplete, duplicate, changed or malformed pages rather than hiding products", async () => {
  const page = (data, total, more) => Response.json(data, { headers: { "X-Total-Count": String(total), "X-Has-More": String(more) } })
  for (const responses of [
    [page([{ id: "A" }], 2, true), Response.json({ error: "Fixture page failed" }, { status: 500 })],
    [page([{ id: "A" }], 2, true), page([{ id: "A" }], 2, false)],
    [page([{ id: "A" }], 2, true), page([{ id: "B" }], 3, true)],
    [page([{ id: "A" }], 2, false)],
    [page([], 2, true)],
    [page([{ id: "A" }], 1, true)],
    [page({ products: [] }, 0, false)],
    [page([{ id: 12 }], 1, false)],
    [Response.json([])],
    [page([], "Infinity", false)],
  ]) {
    const client = sourceLoader({ "@/lib/api-client": { apiFetch: async () => {
      assert.ok(responses.length, "pagination must not loop after a bad response")
      return responses.shift()
    } } }).load("lib/admin-products-client.ts")
    await assert.rejects(client.fetchAllAdminProducts(), /failed|changed|incomplete|progress|Invalid|pagination/)
  }
})

test("admin loader supports an empty catalogue and retries cleanly after a failed read", async () => {
  let fail = true
  const client = sourceLoader({ "@/lib/api-client": { apiFetch: async () => {
    if (fail) return Response.json({ error: "Fixture failure" }, { status: 500 })
    return Response.json([], { headers: { "X-Total-Count": "0", "X-Has-More": "false" } })
  } } }).load("lib/admin-products-client.ts")
  await assert.rejects(client.fetchAllAdminProducts(), /Fixture failure/)
  fail = false
  assert.equal((await client.fetchAllAdminProducts()).length, 0)
})

test("Products table, category extraction and metadata template all use the complete paginated loader", () => {
  const page = fs.readFileSync(new URL("../app/admin/products/page.tsx", import.meta.url), "utf8")
  assert.equal((page.match(/fetchAllAdminProducts\(/g) || []).length, 4)
  assert.equal(page.includes('"/api/products?include_inactive=true"'), false)
  assert.equal(page.includes("include_inactive=true&limit=100000"), false)
})

function priceDownloadHarness(records, failure = false) {
  const state = []
  let cursor = 0
  const files = [], messages = [], requests = []
  const loader = sourceLoader({
    react: {
      useState: initial => {
        const index = cursor++
        if (!(index in state)) state[index] = initial
        return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value }]
      },
      useEffect: () => {},
    },
    "@/contexts/AuthContext": { useAuth: () => ({ user: { id: "fixture-admin" }, isLoading: false, canAccessAdmin: true }) },
    "@/components/ExcelUpload": () => null,
    "@/lib/api-client": { apiFetch: async (url, options) => {
      requests.push(url)
      assert.equal(options.cache, "no-store")
      if (failure) return Response.json({ error: "Fixture catalogue unavailable" }, { status: 503 })
      const params = new URL(url, "https://fixture.invalid").searchParams
      const skip = Number(params.get("skip")), limit = Number(params.get("limit"))
      return Response.json(records.slice(skip, skip + limit), {
        headers: { "X-Total-Count": String(records.length), "X-Has-More": String(skip + limit < records.length) },
      })
    } },
    xlsx: { ...XLSX, writeFile: (book, filename) => files.push({
      filename, bytes: XLSX.write(book, { type: "array", bookType: "xlsx" }),
    }) },
    "react-hot-toast": { toast: { success: message => messages.push(message), error: message => messages.push(message) } },
  })
  const Page = loader.load("app/admin/products/page.tsx").default
  const render = () => { cursor = 0; return Page() }
  const elements = node => {
    if (node == null || typeof node !== "object") return []
    if (Array.isArray(node)) return node.flatMap(elements)
    return [node, ...elements(node.props?.children)]
  }
  const text = node => {
    if (typeof node === "string" || typeof node === "number") return String(node)
    if (Array.isArray(node)) return node.map(text).join("")
    return node && typeof node === "object" ? text(node.props?.children) : ""
  }
  const button = label => elements(render()).find(element => element.type === "button" && text(element.props.children).trim() === label)
  const open = () => button("Update Prices").props.onClick()
  return { open, button, files, messages, requests }
}

test("actual Bulk Price download exports every customer-visible product, not just the displayed page, with five current-value columns", async () => {
  const records = Array.from({ length: 1205 }, (_, index) => ({
    id: `ID${index}`, itemno: String(index).padStart(6, "0"),
    price: index + 10, mrp: index + 100, stock: index % 5,
    active: index % 2 === 0,
  }))
  records.push({ id: "MISSING-FLAG", itemno: "HIDDEN", price: 10, mrp: 20, stock: 2 })
  const harness = priceDownloadHarness(records)
  harness.open()
  await harness.button("Download active products Excel").props.onClick()
  assert.equal(harness.files.length, 1)
  assert.equal(harness.files[0].filename, "active-products-price-mrp-stock.xlsx")
  assert.equal(harness.requests.length, 13)
  const book = XLSX.read(harness.files[0].bytes, { type: "array" })
  const sheet = book.Sheets["Active Products"]
  const values = XLSX.utils.sheet_to_json(sheet)
  assert.deepEqual(XLSX.utils.sheet_to_json(sheet, { header: 1 })[0], ["itemno", "price", "mrp", "stock", "active"])
  assert.equal(values.length, 603)
  assert.deepEqual(values[0], { itemno: "000000", price: 10, mrp: 100, stock: 0, active: "active" })
  assert.equal(values.at(-1).itemno, "001204")
  assert.equal(values.some(value => value.itemno === "000001" || value.itemno === "HIDDEN"), false)
  assert.equal(harness.button("Download active products Excel").props.disabled, false)
  assert.match(harness.messages.at(-1), /603 customer-visible products/)
})

test("active price export preserves actual zero/missing values and legacy item numbers without inventing sample products", () => {
  const { buildActiveProductPriceSheet } = sourceLoader().load("lib/admin-products-client.ts")
  const records = [
    { id: "A", active: true, raw: { "Item No.": "000001" }, price: 0, mrp: 0, stock: 0 },
    { id: "B", active: true, sku: "SKU-B" },
    { id: "C", active: false, sku: "INACTIVE", price: 1, mrp: 2, stock: 3 },
  ]
  const rows = buildActiveProductPriceSheet(records)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].itemno, "000001")
  assert.equal(rows[0].price, 0)
  assert.equal(rows[0].mrp, 0)
  assert.equal(rows[0].stock, 0)
  assert.equal(rows[1].price, "")
  assert.equal(rows[1].stock, "")
  assert.equal(rows[1].mrp, "")
  assert.throws(() => buildActiveProductPriceSheet([]), /no customer-visible products/)
  assert.throws(() => buildActiveProductPriceSheet([{ id: "D", active: true }]), /no item number/)
  assert.throws(() => buildActiveProductPriceSheet([
    { id: "E", active: true, itemno: "DUP" }, { id: "F", active: true, sku: "DUP" },
  ]), /Multiple active products/)
})

test("download errors or no active products show an explicit error and create no spreadsheet", async () => {
  for (const [records, fail, expected] of [
    [[{ id: "A", itemno: "A", active: false }], false, /no customer-visible products/],
    [[], true, /Fixture catalogue unavailable/],
    [[{ id: "A", active: true }], false, /no item number/],
  ]) {
    const harness = priceDownloadHarness(records, fail)
    harness.open()
    await harness.button("Download active products Excel").props.onClick()
    assert.equal(harness.files.length, 0)
    assert.match(harness.messages.at(-1), expected)
    assert.equal(harness.button("Download active products Excel").props.disabled, false)
  }
})

test("visibility accepts active/inactive and explicit boolean/numeric equivalents with accurate preview and atomic updates", async () => {
  for (const [value, expected] of [
    ["active", true], [" ACTIVE ", true], [true, true], ["true", true], [1, true], ["1", true],
    ["inactive", false], [" InActive ", false], [false, false], ["false", false], [0, false], ["0", false],
  ]) {
    const fixture = priceFixture([{ _id: new ObjectId(), itemno: "A", price: 50, mrp: 100, stock: 3, active: !expected }])
    const rows = [{ itemno: "A", price: 60, mrp: 120, stock: 0, active: value }]
    const preview = await fixture.process(rows, true)
    assert.equal(preview.updates[0].status, "valid")
    assert.equal(preview.updates[0].oldActive, !expected)
    assert.equal(preview.updates[0].newActive, expected)
    assert.equal(fixture.writes.length, 0)
    assert.equal((await fixture.process(rows, false)).success, 1)
    assert.equal(fixture.writes[0].filter.active, !expected)
    assert.equal(fixture.writes[0].update.$set.active, expected)
    assert.equal(fixture.writes[0].update.$set.price, 60)
    assert.equal(fixture.writes[0].update.$set.mrp, 120)
    assert.equal(fixture.writes[0].update.$set.stock, 0)
  }
})

test("blank or omitted visibility preserves the stored flag for legacy four/two-column files", async () => {
  for (const value of [undefined, null, "", "  "]) {
    for (const stored of [true, false, undefined]) {
      const fixture = priceFixture([{ _id: new ObjectId(), itemno: "A", price: 50, mrp: 100, stock: 3, active: stored }])
      const rows = [{ itemno: "A", price: 60, active: value }]
      const preview = await fixture.process(rows, true)
      assert.equal(preview.updates[0].newActive, stored === true)
      assert.equal((await fixture.process(rows, false)).success, 1)
      assert.equal(Object.hasOwn(fixture.writes[0].update.$set, "active"), false)
      assert.equal(Object.hasOwn(fixture.writes[0].filter, "active"), false)
    }
  }
})

test("invalid visibility blocks the whole row without changing price, MRP or stock", async () => {
  for (const value of ["visible", "yes", 2, -1, {}, [], ["active"], "falseish"]) {
    const fixture = priceFixture([{ _id: new ObjectId(), itemno: "A", price: 50, mrp: 100, stock: 3, active: true }])
    const rows = [{ itemno: "A", price: 60, mrp: 120, stock: 0, active: value }]
    const preview = await fixture.process(rows, true)
    assert.equal(preview.updates[0].status, "error")
    assert.match(preview.updates[0].error, /Active must be/)
    assert.equal((await fixture.process(rows, false)).failed, 1)
    assert.equal(fixture.writes.length, 0)
  }
})

test("active-product workbook round-trip can hide and reactivate a product through the existing price upload route", async () => {
  const product = { _id: new ObjectId(), itemno: "000123", sku: "000123", price: 50, mrp: 100, stock: 3, active: true }
  const catalog = adminCatalogFixture([product], { fullAdmin: false })
  const { buildActiveProductPriceSheet } = sourceLoader().load("lib/admin-products-client.ts")
  const rows = buildActiveProductPriceSheet([{ ...product, id: product._id.toString() }])
  const writes = []
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/db-service": { getCollection: async () => ({
      find: () => ({ toArray: async () => [product] }),
      findOneAndUpdate: async (filter, update) => {
        assert.equal(filter.active, product.active)
        writes.push(update.$set)
        Object.assign(product, update.$set)
        return product
      },
    }) },
  }, { context: { Blob } })
  const route = loader.load("app/api/products/bulk-price-update/route.ts")
  const post = async (active, preview) => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.map(row => ({ ...row, active }))), "Active Products")
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" })
    const form = new FormData()
    form.set("file", new Blob([bytes]), "active-products.xlsx")
    form.set("preview", String(preview))
    return route.POST(new Request("https://fixture.invalid/api/products/bulk-price-update", { method: "POST", body: form }))
  }
  const visible = async () => (await (await catalog.route.GET(new Request("https://fixture.invalid/api/products"))).json()).length
  assert.equal(await visible(), 1)
  const preview = await (await post("inactive", true)).json()
  assert.equal(preview.updates[0].sku, "000123")
  assert.equal(preview.updates[0].newActive, false)
  assert.equal(product.active, true)
  assert.equal((await (await post("inactive", false)).json()).success, 1)
  assert.equal(await visible(), 0)
  assert.equal((await (await post("active", false)).json()).success, 1)
  assert.equal(await visible(), 1)
  assert.equal(writes.length, 2)
})

test("concurrent visibility changes reject the price row rather than overwriting customer visibility", async () => {
  const product = { _id: new ObjectId(), itemno: "A", price: 50, mrp: 100, stock: 3, active: true }
  const importer = sourceLoader({ "@/lib/db-service": { getCollection: async () => ({
    find: () => ({ toArray: async () => [product] }),
    findOneAndUpdate: async filter => {
      assert.equal(filter.active, true)
      product.active = false
      return null
    },
  }) } }).load("lib/product-price-import.ts")
  const result = await importer.processProductPrices([{ itemno: "A", price: 60, mrp: 120, stock: 0, active: "active" }], false)
  assert.equal(result.success, 0)
  assert.match(result.errors[0], /Product changed/)
  assert.equal(product.price, 50)
  assert.equal(product.mrp, 100)
  assert.equal(product.stock, 3)
  assert.equal(product.active, false)
})
