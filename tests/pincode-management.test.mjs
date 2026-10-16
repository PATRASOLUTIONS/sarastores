import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"
import { sourceLoader } from "./source-loader.mjs"

const bufferFor = (rows, customize) => {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  customize?.(sheet)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Pincodes")
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" })
}
const importer = sourceLoader().load("lib/pincode-import.ts")

test("Excel format accepts text/numeric pincodes, optional metadata, blank rows and normalized headers", () => {
  const parsed = importer.readPincodeSpreadsheet(bufferFor([
    [" PINCODE ", "Name", "State"], ["560001", "GPO", "Karnataka"], [],
    [400001, "Fort", "Maharashtra"], ["110001", "", ""],
  ]))
  assert.equal(parsed.entries.length, 3)
  assert.equal(parsed.entries[1].pincode, "400001")
  assert.equal(parsed.entries[0].name, "GPO")
  assert.equal(importer.readPincodeSpreadsheet(bufferFor([["Pincode"], ["560001"]])).entries[0].state, "")
})

test("Excel duplicates are merged deterministically with the last row winning", () => {
  const result = importer.readPincodeSpreadsheet(bufferFor([
    ["Pincode", "Name"], ["560001", "First"], [560001, "Last"],
  ]))
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].name, "Last")
  assert.equal(result.duplicateRows, 1)
})

test("Excel validation reports row numbers and rejects the entire invalid import", () => {
  for (const value of ["bad", "56000", "5600012", 560001.5, "5.60001e5", true]) {
    assert.throws(() => importer.readPincodeSpreadsheet(bufferFor([["Pincode"], ["560001"], [value]])), /Row 3.*Nothing was imported/)
  }
  assert.throws(() => importer.readPincodeSpreadsheet(bufferFor([["Code"], ["560001"]])), /Pincode.*column/)
  assert.throws(() => importer.readPincodeSpreadsheet(bufferFor([["Pincode", "PINCODE"], ["560001", "560002"]])), /Duplicate/)
  assert.throws(() => importer.readPincodeSpreadsheet(bufferFor([["Pincode"]])), /no pincode rows/)
  assert.throws(() => importer.readPincodeSpreadsheet(bufferFor([["Pincode", "Name"], ["560001", 123]])), /Row 2/)
  assert.throws(() => importer.readPincodeSpreadsheet(bufferFor([["Pincode"], ["560001"]], sheet => { sheet.A2.f = "560000+1" })), /not formulas/)
})

test("Excel import is bounded by file size and row count", () => {
  assert.throws(() => importer.readPincodeSpreadsheet(new ArrayBuffer(importer.MAX_PINCODE_IMPORT_BYTES + 1)), /3 MB/)
  assert.throws(() => importer.readPincodeSpreadsheet(bufferFor([["Pincode"], ["560001"]], sheet => {
    sheet["!ref"] = "A1:A20002"
  })), /data rows/)
})

test("the documented 20,000-row Excel limit is supported exactly", () => {
  const data = bufferFor([["Pincode"], ...Array.from({ length: 20000 }, (_, index) => [String(100000 + index)])])
  assert.ok(data.byteLength <= importer.MAX_PINCODE_IMPORT_BYTES)
  assert.equal(importer.readPincodeSpreadsheet(data).entries.length, 20000)
})

function evaluate(expression, document, variables = {}) {
  if (Array.isArray(expression)) return expression.map(value => evaluate(value, document, variables))
  if (typeof expression === "string") {
    if (expression.startsWith("$$")) {
      const [name, ...path] = expression.slice(2).split(".")
      return path.reduce((value, field) => value?.[field], variables[name])
    }
    if (expression.startsWith("$")) return document[expression.slice(1)]
    return expression
  }
  if (!expression || typeof expression !== "object") return expression
  if ("$literal" in expression) return expression.$literal
  if ("$ifNull" in expression) {
    const values = evaluate(expression.$ifNull, document, variables)
    return values[0] ?? values[1]
  }
  if ("$type" in expression) return typeof evaluate(expression.$type, document, variables)
  if ("$eq" in expression) { const [a, b] = evaluate(expression.$eq, document, variables); return a === b }
  if ("$cond" in expression) return evaluate(expression.$cond[evaluate(expression.$cond[0], document, variables) ? 1 : 2], document, variables)
  if ("$in" in expression) { const [value, list] = evaluate(expression.$in, document, variables); return list.includes(value) }
  if ("$not" in expression) return !evaluate(expression.$not[0], document, variables)
  if ("$concatArrays" in expression) return evaluate(expression.$concatArrays, document, variables).flat()
  if ("$filter" in expression) {
    const filter = expression.$filter
    return evaluate(filter.input, document, variables).filter(entry => evaluate(filter.cond, document, { ...variables, [filter.as]: entry }))
  }
  throw new Error("Unexpected fixture aggregation expression")
}

function fixture({ authorized = true, acknowledged = true } = {}) {
  const documents = new Map([
    ["allowed_list", { key: "allowed_list", pincodes: ["560001", { pincode: "400001", name: "Fort", state: "Maharashtra" }] }],
    ["blocked_list", { key: "blocked_list", pincodes: ["110001"] }],
    ["mode", { key: "mode", value: "allowed" }],
  ])
  const writes = []
  const collection = {
    findOne: async ({ key }) => documents.get(key) ?? null,
    createIndex: async (keys, options) => { assert.equal(keys.key, 1); assert.equal(options.unique, true) },
    updateOne: async ({ key }, update) => {
      writes.push({ key, update })
      if (!acknowledged) return { acknowledged: false }
      const document = documents.get(key) ?? { key }
      const fields = Array.isArray(update) ? Object.fromEntries(Object.entries(update[0].$set)
        .map(([name, expression]) => [name, evaluate(expression, document)])) : update.$set
      documents.set(key, { ...document, ...fields })
      return { acknowledged: true }
    },
  }
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) } },
    "@/lib/db-service": { getCollection: async name => { assert.equal(name, "blocked_pincodes"); return collection } },
  }, { context: { Blob, File, FormData } })
  return {
    loader, documents, writes,
    route: loader.load("app/api/blocked-pincodes/route.ts"),
    importRoute: loader.load("app/api/blocked-pincodes/import/route.ts"),
  }
}
const jsonRequest = (method, body) => new Request("http://fixture.invalid/api/blocked-pincodes", { method, body: JSON.stringify(body) })
const upload = (buffer, list = "allowed", filename = "pincodes.xlsx") => {
  const form = new FormData()
  form.set("listType", list)
  form.set("file", new File([buffer], filename))
  return new Request("http://fixture.invalid/api/blocked-pincodes/import", { method: "POST", body: form })
}

test("GET preserves legacy strings and object metadata without caching availability", async () => {
  const response = await fixture().route.GET()
  const body = await response.json()
  assert.equal(body.allowedPincodes[0], "560001")
  assert.equal(body.allowedPincodes[1].name, "Fort")
  assert.equal(body.allowedPincodes[1].state, "Maharashtra")
  assert.equal(response.headers.get("cache-control"), "no-store")
})

test("admin guards protect every mutation, including Excel upload", async () => {
  const app = fixture({ authorized: false })
  assert.equal((await app.route.POST(jsonRequest("POST", { mode: "all" }))).status, 403)
  assert.equal((await app.route.DELETE(jsonRequest("DELETE", { clear: true, listType: "allowed" }))).status, 403)
  assert.equal((await app.importRoute.POST(upload(bufferFor([["Pincode"], ["560001"]])))).status, 403)
  assert.equal(app.writes.length, 0)
})

test("all mode is persisted independently and preserves both lists", async () => {
  const app = fixture()
  const before = JSON.stringify([...app.documents.values()].slice(0, 2))
  assert.equal((await app.route.POST(jsonRequest("POST", { mode: "all" }))).status, 200)
  assert.equal((await (await app.route.GET()).json()).mode, "all")
  assert.equal(JSON.stringify([...app.documents.values()].slice(0, 2)), before)
  const policy = app.loader.load("lib/pincode-policy.ts")
  const rules = await (await app.route.GET()).json()
  assert.equal(policy.isPincodeAllowed(rules, "110001"), true, "All mode ignores even the blocked list")
  assert.equal(policy.isDeliveryRegionAllowed("all", "Mumbai", "Maharashtra"), true)
  assert.equal(policy.isDeliveryRegionAllowed("blocked", "Mumbai", "Maharashtra"), false)
  assert.equal(policy.isDeliveryRegionAllowed("both", "Bengaluru", "Karnataka"), true)
  assert.equal(policy.isPincodeAllowed(rules, "bad"), false)
})

for (const mutation of [
  { pincode: "560001", listType: "allowed" },
  { pincodes: ["560001", "400001"], listType: "allowed" },
  { clear: true, listType: "allowed" },
]) {
  test(`allowed entries support ${"clear" in mutation ? "clear-all" : "pincodes" in mutation ? "selected" : "individual"} removal without changing blocked list or mode`, async () => {
    const app = fixture()
    assert.equal((await app.route.DELETE(jsonRequest("DELETE", mutation))).status, 200)
    const remaining = app.documents.get("allowed_list").pincodes
    assert.equal(remaining.length, "pincode" in mutation ? 1 : 0)
    assert.equal(app.documents.get("blocked_list").pincodes[0], "110001")
    assert.equal(app.documents.get("mode").value, "allowed")
    assert.equal(app.writes.length, 1, "Selected removal is one atomic document update")
  })
}

test("empty, ambiguous and malformed removals cannot clear a list", async () => {
  const app = fixture()
  for (const body of [
    { listType: "allowed" }, { pincodes: [], listType: "allowed" }, { clear: false, listType: "allowed" },
    { clear: true, pincode: "560001", listType: "allowed" }, { pincodes: ["bad"], listType: "allowed" },
  ]) assert.equal((await app.route.DELETE(jsonRequest("DELETE", body))).status, 400)
  assert.equal(app.writes.length, 0)
})

test("Excel uploads merge the chosen list atomically without losing existing entries or changing mode", async () => {
  for (const list of ["allowed", "blocked"]) {
    const app = fixture()
    const response = await app.importRoute.POST(upload(bufferFor([
      ["Pincode", "Name", "State"], ["560001", "Updated GPO", "Karnataka"],
      ["500001", "Hyderabad", "Telangana"], ["500001", "Last duplicate", "Telangana"],
    ]), list))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.imported, 2)
    assert.equal(body.duplicateRows, 1)
    const entries = app.documents.get(`${list}_list`).pincodes
    assert.equal(entries.length, 3)
    assert.equal(entries.filter(entry => entry.pincode === "560001").length, 1)
    assert.equal(entries.find(entry => entry.pincode === "500001").name, "Last duplicate")
    assert.equal(app.documents.get("mode").value, "allowed")
    assert.equal(app.writes.length, 1)
  }
})

test("invalid spreadsheets, file types, list types and oversized uploads never write partial rows", async () => {
  const app = fixture()
  for (const [data, list, filename, status] of [
    [bufferFor([["Pincode"], ["560001"], ["bad"]]), "allowed", "file.xlsx", 400],
    [bufferFor([["Pincode"], ["560001"]]), "wrong", "file.xlsx", 400],
    [bufferFor([["Pincode"], ["560001"]]), "allowed", "file.txt", 400],
    [new ArrayBuffer(importer.MAX_PINCODE_IMPORT_BYTES + 1), "allowed", "file.xlsx", 413],
  ]) assert.equal((await app.importRoute.POST(upload(data, list, filename))).status, status)
  assert.equal(app.writes.length, 0)
})

test("unacknowledged database writes are failures, never successful import/delete responses", async () => {
  const app = fixture({ acknowledged: false })
  assert.equal((await app.importRoute.POST(upload(bufferFor([["Pincode"], ["560001"]])))).status, 500)
  assert.equal((await app.route.DELETE(jsonRequest("DELETE", { clear: true, listType: "allowed" }))).status, 500)
})

test("nationwide saved-address validation accepts every Indian state, while rejecting malformed addresses", () => {
  const schema = sourceLoader().load("lib/validation.ts").SavedDeliveryAddressSchema
  const base = { firstName: "Synthetic", phone: "9876543210", address: "Synthetic Test Street", pincode: "400001", country: "India" }
  const { indianStates } = sourceLoader().load("lib/indiaData.ts")
  for (const state of indianStates) assert.equal(schema.safeParse({ ...base, city: "Synthetic City", state }).success, true)
  const normalized = schema.parse({ ...base, city: " bengaluru ", state: " karnataka " })
  assert.equal(normalized.city, "Bangalore")
  assert.equal(normalized.state, "Karnataka")
  for (const invalid of [{ state: "Unknown" }, { city: "" }, { pincode: "bad" }, { country: "Other" }]) {
    assert.equal(schema.safeParse({ ...base, city: "Mumbai", state: "Maharashtra", ...invalid }).success, false)
  }
})

function nodes(value) {
  if (!value || typeof value !== "object") return []
  if (Array.isArray(value)) return value.flatMap(nodes)
  return [value, ...nodes(value.props?.children)]
}
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate) }

function adminPageFixture(setup) {
  const app = fixture()
  setup?.(app.documents)
  let index = 0
  let mounted = false
  let confirmation = true
  const states = []
  const effects = []
  const downloads = []
  const messages = []
  const slot = initial => {
    const current = index++
    if (!(current in states)) states[current] = initial
    return current
  }
  const jsx = (type, props) => ({ type, props })
  const loader = sourceLoader({
    react: {
      useState: initial => {
        const current = slot(initial)
        return [states[current], value => { states[current] = typeof value === "function" ? value(states[current]) : value }]
      },
      useRef: initial => states[slot({ current: initial })],
      useEffect: effect => { if (!mounted) effects.push(effect) },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    xlsx: { ...XLSX, writeFile: (workbook, filename) => downloads.push({ workbook, filename }) },
    "react-hot-toast": { toast: { success: message => messages.push(message), error: message => messages.push(message) } },
  }, {
    context: { FormData, Blob, File, window: { confirm: () => confirmation } },
    fetch: async (url, options) => {
      const request = new Request(`http://fixture.invalid${url}`, options)
      if (url.endsWith("/import")) return app.importRoute.POST(request)
      return app.route[request.method](request)
    },
  })
  const page = loader.load("app/admin/blocked-pincodes/page.tsx")
  const render = () => { index = 0; return nodes(page.default()) }
  render()
  mounted = true
  for (const effect of effects) effect()
  return { ...app, render, downloads, messages, confirm: value => { confirmation = value } }
}

test("admin page renders legacy allowed entries with working individual, selected and clear-list controls", async () => {
  const page = adminPageFixture()
  await flush()
  const control = label => page.render().find(node => node.props?.["aria-label"] === label)
  assert.ok(control("Remove 560001 from allowed list"), "Legacy string pincode must have a valid removal action")
  assert.ok(page.render().some(node => node.type === "p" && node.props.children === "Fort"))
  control("Remove 560001 from allowed list").props.onClick()
  await flush()
  assert.equal(page.documents.get("allowed_list").pincodes.length, 1)
  control("Select 400001 in allowed list").props.onChange({ target: { checked: true } })
  const allowedSection = page.render().find(node => node.type === "section" && node.props["aria-label"] === "Allowed Pincodes")
  nodes(allowedSection).find(node => node.type === "button" && nodes(node).some(child =>
    Array.isArray(child.props?.children) && child.props.children[0] === "Remove selected (")).props.onClick()
  await flush()
  assert.equal(page.documents.get("allowed_list").pincodes.length, 0)
  const blockedSection = page.render().find(node => node.type === "section" && node.props["aria-label"] === "Blocked Pincodes")
  nodes(blockedSection).find(node => node.type === "button" && Array.isArray(node.props.children) &&
    node.props.children.join("") === "Clear blocked list").props.onClick()
  await flush()
  assert.equal(page.documents.get("blocked_list").pincodes.length, 0)
})

test("admin clear-all and nationwide-mode confirmation can be cancelled without mutation", async () => {
  const page = adminPageFixture()
  await flush()
  page.confirm(false)
  const allowedSection = page.render().find(node => node.type === "section" && node.props["aria-label"] === "Allowed Pincodes")
  nodes(allowedSection).find(node => node.type === "button" && Array.isArray(node.props.children) &&
    node.props.children.join("") === "Clear allowed list").props.onClick()
  page.render().find(node => node.type === "input" && node.props.value === "all").props.onChange()
  await flush()
  assert.equal(page.writes.length, 0)
  page.confirm(true)
  page.render().find(node => node.type === "input" && node.props.value === "all").props.onChange()
  await flush()
  assert.equal(page.documents.get("mode").value, "all")
  assert.equal(page.documents.get("allowed_list").pincodes.length, 2)
})

test("admin Excel format downloads a usable workbook and import targets the selected list", async () => {
  const page = adminPageFixture()
  await flush()
  page.render().find(node => node.type === "button" && Array.isArray(node.props.children) &&
    node.props.children.includes(" Download Excel format")).props.onClick()
  assert.equal(page.downloads.length, 1)
  assert.equal(page.downloads[0].filename, "pincodes_import_template.xlsx")
  const format = XLSX.write(page.downloads[0].workbook, { type: "array", bookType: "xlsx" })
  assert.equal(importer.readPincodeSpreadsheet(format).entries.length, 3)
  const allowedSection = page.render().find(node => node.type === "section" && node.props["aria-label"] === "Allowed Pincodes")
  nodes(allowedSection).find(node => node.type === "button" && Array.isArray(node.props.children) &&
    node.props.children.includes(" Import Excel")).props.onClick()
  const input = { files: [new File([bufferFor([["Pincode"], ["500001"]])], "fixture.xlsx")], value: "fixture.xlsx" }
  page.render().find(node => node.type === "input" && node.props.type === "file").props.onChange({ currentTarget: input })
  await flush()
  assert.equal(page.documents.get("allowed_list").pincodes.length, 3)
  assert.equal(page.documents.get("blocked_list").pincodes.length, 1)
  assert.equal(input.value, "")
  assert.ok(page.messages.some(message => message.includes("Imported 1 unique pincodes into the allowed list")))
})

test("large imported lists render 100 rows per page and Select shown removes only that page", async () => {
  const page = adminPageFixture(documents => documents.set("allowed_list", {
    key: "allowed_list", pincodes: Array.from({ length: 250 }, (_, index) => String(100000 + index)),
  }))
  await flush()
  const section = () => page.render().find(node => node.type === "section" && node.props["aria-label"] === "Allowed Pincodes")
  const rows = () => nodes(section()).filter(node => node.type === "input" && node.props["aria-label"]?.startsWith("Select "))
  assert.equal(rows().length, 100)
  const shown = nodes(section()).find(node => node.type === "input" && node.props.type === "checkbox" && !node.props["aria-label"])
  shown.props.onChange({ target: { checked: true } })
  nodes(section()).find(node => node.type === "button" && node.props.children === "Next").props.onClick()
  assert.equal(rows().length, 100)
  assert.ok(rows().every(row => row.props.checked === false))
  nodes(section()).find(node => node.type === "button" && Array.isArray(node.props.children) &&
    node.props.children[0] === "Remove selected (").props.onClick()
  await flush()
  assert.equal(page.documents.get("allowed_list").pincodes.length, 150)
  assert.equal(page.documents.get("allowed_list").pincodes[0], "100100")
})
