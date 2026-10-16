import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

test("a Flipkart short link is resolved from the JSON body when HTTP status is not 200", async () => {
  const body = JSON.stringify({
    STATUS_CODE: 503,
    RESPONSE: { redirectUrl: "https://dl.flipkart.com/dl/samsung-fridge/p/itm123?pid=ABC" },
  })
  const http = sourceLoader({
    axios: { get: async () => ({ status: 503, data: body, headers: {} }) },
  }).load("lib/scrapers/http.ts")
  assert.equal(
    await http.resolveRedirect("https://dl.flipkart.com/s/ZunNveuuuN"),
    "https://www.flipkart.com/samsung-fridge/p/itm123?pid=ABC",
  )
})

test("pasted Flipkart short links are resolved before the product scrape", async () => {
  const http = sourceLoader().load("lib/scrapers/http.ts")
  const seen = []
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/scrapers/http": {
      detectSource: http.detectSource,
      isShortLink: http.isShortLink,
      resolveRedirect: async (url) => {
        seen.push(url)
        return "https://www.flipkart.com/phone/p/itm123?pid=ABC"
      },
    },
    "@/lib/scrapers/adapters": {
      ADAPTERS: { flipkart: async (url) => ({ sourceUrl: url, sap: { name: "Phone" } }) },
    },
  }).load("app/api/scrape/route.ts")

  const response = await route.POST(new Request("https://fixture.invalid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "dl.flipkart.com/s/ZunNveuuuN" }),
  }))
  assert.equal(response.status, 200)
  assert.deepEqual(seen, ["https://dl.flipkart.com/s/ZunNveuuuN"])
  assert.equal((await response.json()).product.sourceUrl, "https://www.flipkart.com/phone/p/itm123?pid=ABC")

  seen.length = 0
  const direct = await route.POST(new Request("https://fixture.invalid", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://www.flipkart.com/phone/p/itm123?pid=ABC" }),
  }))
  assert.equal(direct.status, 200)
  assert.deepEqual(seen, [])
})
