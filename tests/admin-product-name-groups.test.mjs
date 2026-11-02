import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"

const { selectAdminNameRows, groupAdminProductNames } = sourceLoader().load("lib/admin-product-name-groups.ts")
const product = (id, stock, extra = {}) => ({ id, name: "Phone 8GB Blue", sku: `SKU-${id}`, stock, active: true, ...extra })
const select = (products, extra = {}) => selectAdminNameRows(products, { enabled: true, search: "", stock: "all", ...extra })
const ids = rows => Array.from(rows, row => row.id)

test("one stocked copy wins, multiple stocked copies choose the maximum without summing", () => {
  const products = [product("zero", 0), product("low", "3"), product("high", 55)]
  const before = JSON.stringify(products)
  assert.deepEqual(ids(select(products).rows), ["high"])
  assert.equal(select(products).rows[0].stock, 55)
  assert.equal(select(products).hiddenAlternatives, 2)
  assert.deepEqual(ids(select(products.slice(0, 2)).rows), ["low"])
  assert.equal(JSON.stringify(products), before)
})

test("zero or equal stock ties prefer active, newest valid update, then stable ID", () => {
  const products = [
    product("inactive", 0, { active: false, updatedAt: "2026-11-01" }),
    product("older", 0, { updatedAt: "2026-10-01" }),
    product("b", 0, { updatedAt: "2026-10-02" }),
    product("a", 0, { updatedAt: "2026-10-02" }),
  ]
  assert.deepEqual(ids(select(products).rows), ["a"])
  assert.deepEqual(ids(select([...products].reverse()).rows), ["a"])
  assert.deepEqual(ids(select([product("b", 5), product("a", 5, { updatedAt: "invalid" })]).rows), ["a"])
  assert.deepEqual(ids(select([product("inactive", 10, { active: false }), product("active", 2)]).rows), ["inactive"], "stock takes precedence over status")
})

test("name grouping tolerates case and spaces but preserves model and variant names", () => {
  const products = [product("a", 1), product("b", 2, { name: "  PHONE   8GB blue " }),
    product("red", 3, { name: "Phone 8GB Red" }), product("capacity", 4, { name: "Phone 16GB Blue" })]
  assert.deepEqual(ids(select(products).rows), ["b", "red", "capacity"])
})

test("missing original names never collapse into an unnamed placeholder group", () => {
  const products = [product("a", 0, { name: "Unnamed Product", groupingName: "" }), product("b", 5, { name: "Unnamed Product", groupingName: "" })]
  assert.equal(select(products).rows.length, 2)
  assert.equal(select([product("a", 0, { name: "" }), product("b", 5, { name: "" })]).rows.length, 2)
})

test("stock filtering follows selection so out-of-stock copies do not replace stocked representatives", () => {
  const products = [product("zero", 0), product("stocked", 3), product("other", 0, { name: "Other phone" })]
  assert.deepEqual(ids(select(products, { stock: "out" }).rows), ["other"])
  assert.deepEqual(ids(select(products, { stock: "in" }).rows), ["stocked"])
})

test("exact item-number search exposes a hidden copy and respects stock filtering", () => {
  const products = [product("hidden", 0, { sku: "000042" }), product("winner", 10)]
  const result = select(products, { search: " 000042 " })
  assert.deepEqual(ids(result.rows), ["hidden"])
  assert.equal(result.exactItemSearch, true)
  assert.equal(result.hiddenAlternatives, 0)
  assert.equal(select(products, { search: "000042", stock: "in" }).rows.length, 0)
  assert.deepEqual(ids(select(products, { search: "000" }).rows), ["winner"])
})

test("legacy item aliases and conflicting code fields can locate the exact record", () => {
  for (const extra of [{ itemno: "0012" }, { itemNo: "0012" }, { raw: { "Item No.": "0012" } }]) {
    assert.deepEqual(ids(select([product("hidden", 0, extra), product("winner", 3)], { search: "0012" }).rows), ["hidden"])
  }
})

test("show-all retains every record and uses the normal stock filter", () => {
  const products = [product("zero", 0), product("low", 3), product("high", 55)]
  assert.deepEqual(ids(select(products, { enabled: false }).rows), ["zero", "low", "high"])
  assert.deepEqual(ids(select(products, { enabled: false, stock: "out" }).rows), ["zero"])
  assert.equal(select(products, { enabled: false }).hiddenAlternatives, 0)
})

test("all alternatives remain accessible and grouping cannot change the input order", () => {
  const products = [product("low", 3), product("high", 55)]
  const before = JSON.stringify(products)
  const groups = groupAdminProductNames(products)
  assert.deepEqual(ids([...groups.values()][0]), ["high", "low"])
  assert.equal(JSON.stringify(products), before)
})

test("invalid stock cannot outrank valid inventory", () => {
  const products = [product("nan", "broken"), product("inf", Infinity), product("negative", -20), product("valid", 1)]
  assert.deepEqual(ids(select(products).rows), ["valid"])
})

test("grouping across the complete catalogue precedes page slicing", () => {
  const products = Array.from({ length: 110 }, (_, n) => product(`other-${n}`, 1, { name: `Other ${n}` }))
  products.unshift(product("zero", 0))
  products.push(product("winner", 25))
  const rows = select(products).rows
  assert.equal(rows.length, 111)
  assert.equal(rows.slice(0, 10)[0].id, "winner")
  assert.equal(rows.some(row => row.id === "zero"), false)
})

test("admin display option selects the stocked row, exposes alternatives and reveals exact item searches", () => {
  const products = [product("hidden", 0), product("winner", 55)]
  const state = new Map([[0, products], [1, 2], [2, true], [13, false], [14, false], [16, "connected"]])
  let index = 0
  const loader = sourceLoader({
    react: {
      useState(initial) {
        const slot = index++
        if (!state.has(slot)) state.set(slot, initial)
        return [state.get(slot), value => state.set(slot, typeof value === "function" ? value(state.get(slot)) : value)]
      },
      useEffect() {}, useMemo: callback => callback(),
    },
    "next/link": ({ children, ...props }) => createElement("a", props, children),
    "@/contexts/AuthContext": { useAuth: () => ({ user: { id: "admin", role: "admin" }, isLoading: false, canAccessAdmin: true }) },
    "@/lib/api-client": { apiFetch: () => { throw new Error("Display toggle must not make a database request") } },
    "@/components/ExcelUpload": () => null,
  })
  const Page = loader.load("app/admin/products/page.tsx").default
  const render = () => { index = 0; return Page() }
  const elements = tree => {
    const found = []
    const visit = node => {
      if (!node || typeof node !== "object") return
      if (Array.isArray(node)) return node.forEach(visit)
      if (node.props) { found.push(node); visit(node.props.children) }
    }
    visit(tree)
    return found
  }
  const displayedIds = tree => elements(tree).filter(node => node.type === "tr" && node.key).map(node => node.key)
  let tree = render()
  assert.deepEqual(displayedIds(tree), ["hidden", "winner"])
  const option = elements(tree).find(node => node.props["aria-label"] === "Product name display")
  option.props.onChange({ target: { value: "one" } })
  tree = render()
  assert.deepEqual(displayedIds(tree), ["winner"])
  const html = renderToStaticMarkup(tree)
  assert.match(html, /1 alternative hidden/)
  assert.match(html, /2 records — view alternatives/)
  assert.match(html, /SKU-hidden/)
  assert.match(html, /\/admin\/products\/hidden\/edit/)
  const search = elements(tree).find(node => node.type === "input" && node.props.type === "text" && node.props.value === "")
  assert.ok(search, "Search input exists")
  search.props.onChange({ target: { value: "SKU-hidden" } })
  tree = render()
  assert.deepEqual(displayedIds(tree), ["hidden"])
  assert.match(renderToStaticMarkup(tree), /Exact item-number search/)
  assert.deepEqual(products.map(row => row.stock), [0, 55])
})
