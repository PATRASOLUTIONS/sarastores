import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

test("public origins accept full URLs, bare domains and loopback ports", () => {
  const { parseSiteOrigin } = sourceLoader().load("lib/site-origin.ts")
  for (const [value, expected] of [
    [" https://sarastores.com/store/?test=1#top ", "https://sarastores.com"],
    ["sarastores.com", "https://sarastores.com"],
    ["//preview.example.com/", "https://preview.example.com"],
    ["localhost:3005", "http://localhost:3005"],
    ["127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["[::1]:3000", "http://[::1]:3000"],
  ]) assert.equal(parseSiteOrigin(value), expected)
})

test("invalid public origins never throw or accept credentials and unsupported schemes", () => {
  const { parseSiteOrigin } = sourceLoader().load("lib/site-origin.ts")
  for (const value of [undefined, null, 1, "", " ", "[REDACTED]", "not a URL", "https://", "javascript:alert(1)",
    "data:123", "ftp://example.com", "https://user:password@example.com", "https://example.com\\other"]) {
    assert.equal(parseSiteOrigin(value), undefined)
  }
  assert.equal(parseSiteOrigin("https://exa\nmple.com"), undefined)
})

function metadataFixture(env = {}, requestHeaders = {}, throwHeaders = false) {
  let reads = 0
  const loader = sourceLoader({
    "@/lib/db-service": { getSettingsData: async () => null },
    "next/headers": { headers: async () => { reads++; if (throwHeaders) throw new Error("Static generation must not read request headers"); return new Headers(requestHeaders) } },
    react: { cache: fn => fn },
  }, { env })
  return { metadata: loader.load("lib/seo-metadata.ts"), loader, reads: () => reads }
}

test("a scheme-less site URL generates metadata for the static 404 without request headers", async () => {
  const f = metadataFixture({ NEXT_PUBLIC_SITE_URL: "sarastores.com", NODE_ENV: "production" }, {}, true)
  const origin = await f.metadata.getOriginFromHeaders()
  assert.equal(origin, "https://www.sarastores.com")
  assert.equal(f.reads(), 0)
  const result = f.metadata.buildPageMetadata({ title: "Page Not Found", description: "404", pageUrl: origin, origin, companyName: "Sara" })
  assert.equal(result.metadataBase.origin, origin)
  assert.equal(new URL(result.openGraph.images[0].url).origin, origin)
})

test("bad primary configuration falls back to another configured origin before headers", async () => {
  for (const key of ["NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]) {
    const f = metadataFixture({ NEXT_PUBLIC_SITE_URL: "[REDACTED]", [key]: "fallback.example.com" }, {}, true)
    assert.equal(await f.metadata.getOriginFromHeaders(), "https://fallback.example.com")
    assert.equal(f.reads(), 0)
  }
})

test("request origins and safe defaults handle missing or invalid configuration", async () => {
  const f = metadataFixture({ NEXT_PUBLIC_SITE_URL: "[REDACTED]" }, { "x-forwarded-host": "store.example.com, proxy.example.com", "x-forwarded-proto": "https" })
  assert.equal(await f.metadata.getOriginFromHeaders(), "https://store.example.com")
  const local = metadataFixture({}, { host: "localhost:3005" })
  assert.equal(await local.metadata.getOriginFromHeaders(), "http://localhost:3005")
  const invalid = metadataFixture({ NODE_ENV: "production" }, { host: "[invalid]" })
  assert.equal(await invalid.metadata.getOriginFromHeaders(), "https://www.sarastores.com")
  assert.equal(await metadataFixture().metadata.getOriginFromHeaders(), "http://localhost:3000")
})

test("the other metadata generator uses the same validated configuration", () => {
  const { loader } = metadataFixture({ NEXT_PUBLIC_SITE_URL: "sarastores.com" })
  const seo = loader.load("lib/seo.tsx")
  assert.equal(seo.generateMetadata({ title: "Sara", description: "Shop" }).metadataBase.origin, "https://www.sarastores.com")
})

test("both Sara hosts share the deployed canonical and the apex redirect preserves paths", async () => {
  for (const origin of ["https://sarastores.com", "https://www.sarastores.com"]) {
    assert.equal(await metadataFixture({ NEXT_PUBLIC_SITE_URL: origin }).metadata.getOriginFromHeaders(), "https://www.sarastores.com")
  }
  const { default: config } = await import("../next.config.mjs")
  const [redirect] = await config.redirects()
  assert.equal(redirect.has[0].value, "sarastores.com")
  assert.equal(redirect.destination, "https://www.sarastores.com/:path*")
  assert.equal(redirect.permanent, true)
})

test('metadata is resolved in the initial HTML head for browsers and unknown preview crawlers', async () => {
  const { default: config } = await import('../next.config.mjs')
  assert.ok(config.htmlLimitedBots instanceof RegExp)
  for (const agent of ['Mozilla/5.0', 'facebookexternalhit/1.1', 'WhatsApp/2.24', 'UnknownPreviewTool/1.0', '']) {
    assert.equal(config.htmlLimitedBots.test(agent), true, `${agent} must receive metadata before HTML streaming`)
  }
})
