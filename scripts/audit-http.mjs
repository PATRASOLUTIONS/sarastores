import assert from "node:assert/strict"
import fs from "node:fs"

const base = process.argv[2]
const output = process.argv[3]
if (!base || !output || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("Usage: node scripts/audit-http.mjs <local-isolated-base-url> <report-path>")
}
const checks = []
async function check(path, status, inspect = async () => {}) {
  const response = await fetch(base + path, { redirect: "manual" })
  assert.equal(response.status, status, path)
  await inspect(response)
  checks.push({ path, status: response.status, passed: true })
  console.log("PASS:", path, response.status)
}
await check("/api/health", 200, async (response) => {
  const body = await response.json()
  assert.equal(body.status, "connected")
  assert.equal("collections" in body, false)
})
await check("/api/products?fields=card&limit=24", 200, async (response) => {
  const products = await response.json()
  assert.ok(Array.isArray(products) && products.length > 0 && products.length <= 24)
  assert.ok(products.some((product) => product.name === "Audit Fixture Television" && product.price === 4999))
  assert.ok(products.every((product) => typeof product.id === "string" && !("_id" in product)))
})
await check("/api/stores", 200, async (response) => {
  const body = await response.json()
  assert.equal(body.success, true)
  assert.ok(body.stores.some((store) => store.name === "Audit Fixture Store"))
  assert.ok(body.stores.every((store) => typeof store.id === "string" && !("_id" in store)))
})
for (const path of ["/api/orders", "/api/users", "/api/admin/partners", "/api/orders/000000000000000000000001/invoice", "/api/account/export"]) {
  await check(path, 401)
}
await check("/api/vendor/products", 403)
for (const path of ["/admin", "/account", "/dashboard"]) {
  await check(path, 307, async (response) => {
    assert.equal(new URL(response.headers.get("location"), base).pathname, "/login")
  })
}
await check("/products", 200, async (response) => {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN")
  const policy = response.headers.get("content-security-policy")
  assert.ok(policy.includes("object-src 'none'") && !policy.includes("'unsafe-eval'"))
  assert.match(await response.text(), /<title>[^<]+<\/title>/)
})
await check("/product/audit-fixture-television", 200, async (response) => {
  const html = await response.text()
  const head = html.slice(0, html.indexOf("</head>"))
  assert.match(head, /Audit Fixture Television/)
  assert.match(head, /property="og:image"/)
})
await check("/brands/audit-fixture", 200)
for (const path of ["/not-a-real-audit-page", "/product/not-a-real-audit-product", "/brands/not-a-real-audit-brand"]) {
  await check(path, 404)
}
await check("/robots.txt", 200, async (response) => {
  assert.match(await response.text(), /Disallow: \/admin/)
})
await check("/sitemap.xml", 200, async (response) => {
  assert.match(await response.text(), /<urlset/)
})
fs.writeFileSync(output, JSON.stringify({
  base, safety: "GET requests only; synthetic isolated database; no providers invoked", checks,
}, null, 2))
console.log(`${checks.length} production HTTP smoke checks passed`)
