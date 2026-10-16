import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

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
