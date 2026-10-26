import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"

function memoryStore() {
  const docs = new Map()
  return {
    docs,
    collection: {
      findOne: async ({ _id }) => docs.get(_id) ?? null,
      updateOne: async ({ _id }, { $set }) => { docs.set(_id, { ...(docs.get(_id) ?? { _id }), ...$set }); return { acknowledged: true } },
    },
  }
}

const loadMemory = store => sourceLoader({
  "@/lib/db-service": { getCollection: async () => store.collection },
}, { env: { SESSION_SECRET: "fixture-secret-value-0123456789" } }).load("lib/consent-memory.ts")

test("a remembered decision follows the account to a new network and marks that network as decided", async () => {
  const store = memoryStore()
  const memory = loadMemory(store)
  await memory.rememberConsent({ userId: "u1", ip: "203.0.113.5", choice: { analytics: true, advertising: false, personalisation: true } })
  for (const key of store.docs.keys()) assert.doesNotMatch(key, /203\.0\.113\.5/, "raw IPs are never stored")

  const elsewhere = await memory.lookupConsent({ userId: "u1", ip: "198.51.100.9" })
  assert.equal(elsewhere.match, "account")
  assert.deepEqual([elsewhere.consent.analytics, elsewhere.consent.advertising, elsewhere.consent.personalisation], [true, false, true])
  assert.equal((await memory.lookupConsent({ ip: "198.51.100.9" })).match, "network")
})

test("a network match never hands over another person's choice, and unknown or stale entries ask again", async () => {
  const store = memoryStore()
  const memory = loadMemory(store)
  await memory.rememberConsent({ ip: "203.0.113.5", choice: { analytics: true, advertising: true, personalisation: true } })
  assert.deepEqual({ ...(await memory.lookupConsent({ userId: "someone-else", ip: "203.0.113.5" })) }, { match: "network", consent: null })
  assert.deepEqual({ ...(await memory.lookupConsent({ ip: "192.0.2.1" })) }, { match: null, consent: null })
  for (const doc of store.docs.values()) doc.version = "old-notice"
  assert.equal((await memory.lookupConsent({ ip: "203.0.113.5" })).match, null)
})

function clientFixture(response) {
  const storage = new Map()
  const window = new EventTarget()
  const calls = []
  window.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }
  window.location = { reload: () => {}, protocol: "https:" }
  const consent = sourceLoader({}, {
    fetch: async (url, init = {}) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : null })
      return Response.json(response)
    },
    context: { window, CustomEvent, console: { ...console, error: () => {} } },
  }).load("lib/consent-client.ts")
  return { consent, calls }
}

test("a new browser restores the account's own choice without logging a new decision", async () => {
  const fixture = clientFixture({ match: "account", consent: { analytics: true, advertising: false, personalisation: true, decidedAt: "2026-10-01T00:00:00.000Z" } })
  const restored = await fixture.consent.restoreRememberedConsent()
  assert.equal(restored.analytics, true)
  assert.equal(restored.inherited, undefined)
  assert.equal(fixture.consent.hasConsent("analytics"), true)
  assert.deepEqual(fixture.calls.map(call => call.method), ["GET"])
})

test("a network match hides the banner with optional tracking off, and an unknown visitor is asked", async () => {
  const network = clientFixture({ match: "network", consent: null })
  const restored = await network.consent.restoreRememberedConsent()
  assert.equal(restored.inherited, true)
  for (const category of ["analytics", "advertising", "personalisation"]) assert.equal(network.consent.hasConsent(category), false)

  const unknown = clientFixture({ match: null, consent: null })
  assert.equal(await unknown.consent.restoreRememberedConsent(), null)
  assert.equal(unknown.consent.readConsent(), null)
})

test("signing in links the browser's own decision to the account, but never an inherited default", async () => {
  const own = clientFixture({ success: true })
  own.consent.writeConsent({ analytics: true })
  own.calls.length = 0
  await own.consent.syncConsentWithAccount()
  assert.deepEqual([own.calls[0].method, own.calls[0].body.analytics], ["PUT", true])

  const network = clientFixture({ match: "network", consent: null })
  await network.consent.restoreRememberedConsent()
  network.calls.length = 0
  await network.consent.syncConsentWithAccount()
  assert.equal(network.calls.some(call => call.method === "PUT"), false, "an inherited default is not linked to the account")

  const fresh = clientFixture({ match: "account", consent: { analytics: false, advertising: true, personalisation: false, decidedAt: "2026-10-01T00:00:00.000Z" } })
  await fresh.consent.syncConsentWithAccount()
  assert.equal(fresh.consent.hasConsent("advertising"), true, "the account's own choice fills a browser with no decision")
})

function routeFixture(session) {
  const remembered = []
  const route = sourceLoader({
    "@/lib/auth": {
      getSession: async () => session,
      requireUser: async () => session
        ? { ok: true, user: session.user } : { ok: false, response: Response.json({ error: "Authentication required" }, { status: 401 }) },
    },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/consent": { recordConsent: async () => 3, clientIpFrom: () => "203.0.113.5", CONSENT_PURPOSES: { ANALYTICS: "analytics", ADVERTISING: "advertising", PERSONALISATION: "personalisation" } },
    "@/lib/consent-memory": {
      rememberConsent: async params => { remembered.push(params) },
      lookupConsent: async () => ({ match: null, consent: null }),
    },
  }).load("app/api/consent/tracking/route.ts")
  const request = (method, body) => new NextRequest("https://fixture.invalid/api/consent/tracking", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  return { route, remembered, request }
}

test("the consent route remembers own decisions only, and linking requires a signed-in user", async () => {
  const { PRIVACY_NOTICE_VERSION } = sourceLoader().load("lib/dpdp-config.ts")
  const anonymous = routeFixture(null)
  await anonymous.route.POST(anonymous.request("POST", { analytics: true, version: PRIVACY_NOTICE_VERSION }))
  await anonymous.route.POST(anonymous.request("POST", { analytics: false, inherited: true, version: PRIVACY_NOTICE_VERSION }))
  assert.equal(anonymous.remembered.length, 1)
  assert.deepEqual([anonymous.remembered[0].userId, anonymous.remembered[0].ip], [null, "203.0.113.5"])
  const body = { analytics: true, advertising: false, personalisation: false, version: PRIVACY_NOTICE_VERSION, decidedAt: "2026-10-01T00:00:00.000Z" }
  assert.equal((await anonymous.route.PUT(anonymous.request("PUT", body))).status, 401)

  const signedIn = routeFixture({ user: { id: "u1" } })
  assert.equal((await signedIn.route.PUT(signedIn.request("PUT", { ...body, version: "old-notice" }))).status, 409)
  assert.equal((await signedIn.route.PUT(signedIn.request("PUT", body))).status, 200)
  assert.equal(signedIn.remembered[0].userId, "u1")
})
