import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

function fixture({ failLedger = false, provider, signedIn = null, providerBusy = false } = {}) {
  const rows = [], calls = []
  let identity = signedIn
  const collection = {
    insertMany: async entries => { if (failLedger) throw new Error("Isolated ledger failure"); rows.push(...entries) },
    findOne: async query => [...rows].reverse().find(row => Object.entries(query).every(([key, value]) => row[key] === value)) || null,
  }
  const loader = sourceLoader({
    "@/lib/auth": { getSession: async () => identity ? { user: { id: identity } } : null },
    "@/lib/db-service": { getCollection: async () => collection, COLLECTIONS: { CONSENT_RECORDS: "consent_records" } },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/rate-limit-store": { rateLimitHit: async () => ({ limited: providerBusy }) },
    "@/lib/api-error": { handleApiError: () => Response.json({ error: "Unexpected failure" }, { status: 500 }) },
  }, {
    context: { console: { error: () => {} } },
    fetch: async (url, options) => { calls.push({ url, options }); return provider ? provider(url, options) : Response.json({ address: { country_code: "in", postcode: "560027" } }) },
  })
  const route = loader.load("app/api/consent/location/route.ts")
  const { DELIVERY_LOCATION_NOTICE_VERSION: version } = loader.load("lib/dpdp-config.ts")
  const post = (body, headers = {}) => route.POST(new Request("https://example.test/api/consent/location", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers } }))
  const grant = async () => {
    const response = await post({ action: "grant", consent: true, adult: true, version })
    assert.equal(response.status, 200)
    return (await response.json()).receipt
  }
  const resolve = receipt => post({ action: "resolve", receipt, latitude: 12.9716123, longitude: 77.5946123 })
  return { rows, calls, post, grant, resolve, version, setIdentity: value => { identity = value } }
}

test("a guest lookup records consent, reduces precision, returns only pincode and ends its grant", async () => {
  const f = fixture()
  const receipt = await f.grant()
  assert.equal(f.calls.length, 0)
  const response = await f.resolve(receipt)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { pincode: "560027" })
  assert.match(response.headers.get("Cache-Control"), /no-store/)
  const url = f.calls[0].url
  assert.equal(url.searchParams.get("lat"), "12.972")
  assert.equal(url.searchParams.get("lon"), "77.595")
  assert.equal(f.calls[0].options.cache, "no-store")
  assert.deepEqual(f.rows.map(row => row.granted), [true, false])
  for (const row of f.rows) {
    assert.equal(row.ipAddress, null)
    assert.equal(row.userAgent, null)
    for (const field of ["latitude", "longitude", "pincode", "coords"]) assert.equal(field in row, false)
  }
  assert.equal((await f.resolve(receipt)).status, 403)
  assert.equal(f.calls.length, 1)
})

test("location requires affirmative adult consent and the current notice", async () => {
  const f = fixture()
  for (const body of [
    { action: "grant", consent: false, adult: true, version: f.version },
    { action: "grant", consent: true, adult: false, version: f.version },
    { action: "grant", consent: true, version: f.version },
    { action: "grant", consent: true, adult: true, version: f.version, userId: "someone-else" },
  ]) assert.equal((await f.post(body)).status, 400)
  assert.equal((await f.post({ action: "grant", consent: true, adult: true, version: "old" })).status, 409)
  assert.equal((await f.post({ action: "grant", consent: true, adult: true, version: f.version }, { Origin: "https://other.test" })).status, 403)
  assert.equal((await f.post({ action: "grant", consent: true, adult: true, version: f.version }, { "Sec-Fetch-Site": "cross-site" })).status, 403)
  assert.equal(f.rows.length, 0)
  assert.equal(f.calls.length, 0)
})

test("withdrawn, expired, unknown and other-account receipts cannot resolve coordinates", async () => {
  const f = fixture({ signedIn: "actual-session-user" })
  const receipt = await f.grant()
  assert.equal(f.rows[0].userId, "actual-session-user")
  f.setIdentity("another-user")
  assert.equal((await f.resolve(receipt)).status, 403)
  f.setIdentity("actual-session-user")
  await f.post({ action: "withdraw", receipt })
  assert.equal((await f.resolve(receipt)).status, 403)
  const expired = await f.grant()
  f.rows.at(-1).createdAt = new Date(Date.now() - 6 * 60 * 1000)
  assert.equal((await f.resolve(expired)).status, 403)
  assert.equal((await f.resolve("f583bd4b-4b49-4eb1-b08a-ab14b0e58d12")).status, 403)
  assert.equal(f.calls.length, 0)
})

test("ledger failure fails closed and invalid coordinates never reach a provider", async () => {
  const failed = fixture({ failLedger: true })
  assert.equal((await failed.post({ action: "grant", consent: true, adult: true, version: failed.version })).status, 503)
  assert.equal(failed.calls.length, 0)
  const f = fixture()
  const receipt = await f.grant()
  assert.equal((await f.post({ action: "resolve", receipt, latitude: 91, longitude: 77 })).status, 400)
  assert.equal(f.calls.length, 0)
})

test("account-wide withdrawal and the provider budget stop a pending lookup", async () => {
  const f = fixture({ signedIn: "session-user" })
  const receipt = await f.grant()
  f.rows.push({ userId: "session-user", anonymousId: null, purpose: "delivery_location", granted: false, createdAt: new Date() })
  assert.equal((await f.resolve(receipt)).status, 403)
  assert.equal(f.calls.length, 0)
  const busy = fixture({ providerBusy: true })
  assert.equal((await busy.resolve(await busy.grant())).status, 429)
  assert.equal(busy.calls.length, 0)
  assert.equal(busy.rows.at(-1).granted, false)
})

test("non-Indian, missing and malformed pincodes fall back to manual entry", async () => {
  for (const address of [{ country_code: "us", postcode: "560027" }, { country_code: "in" }, { country_code: "in", postcode: "bad" }]) {
    const f = fixture({ provider: () => Response.json({ address }) })
    assert.equal((await f.resolve(await f.grant())).status, 422)
    assert.equal(f.rows.at(-1).granted, false)
  }
  const f = fixture({ provider: () => { throw new Error("Provider failed with sensitive URL") } })
  const response = await f.resolve(await f.grant())
  assert.equal(response.status, 502)
  assert.doesNotMatch(JSON.stringify(await response.json()), /sensitive/)
})

function clientFixture({ position, request, secure = true } = {}) {
  const calls = [], fixes = []
  const loader = sourceLoader({}, {
    context: {
      window: { isSecureContext: secure }, DOMException,
      navigator: { geolocation: { getCurrentPosition: (ok, fail, options) => {
        fixes.push(options)
        if (position) position(ok, fail)
        else ok({ coords: { latitude: 12.9716123, longitude: 77.5946123 } })
      } } },
    },
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body)
      calls.push(body)
      if (request) return request(body, calls, fixes)
      return Response.json(body.action === "grant" ? { receipt: "test-receipt" } : body.action === "resolve" ? { pincode: "560027" } : { success: true })
    },
  })
  return { client: loader.load("lib/delivery-location-client.ts"), calls, fixes }
}

test("client does not access location without consent, HTTPS or a successfully recorded grant", async () => {
  const f = clientFixture()
  await assert.rejects(f.client.detectDeliveryPincode(false, new AbortController().signal), /agree/)
  assert.equal(f.fixes.length + f.calls.length, 0)
  const insecure = clientFixture({ secure: false })
  await assert.rejects(insecure.client.detectDeliveryPincode(true, new AbortController().signal), /secure/)
  assert.equal(insecure.fixes.length + insecure.calls.length, 0)
  const failed = clientFixture({ request: () => Response.json({ error: "Ledger unavailable" }, { status: 503 }) })
  await assert.rejects(failed.client.detectDeliveryPincode(true, new AbortController().signal), /Ledger/)
  assert.equal(failed.fixes.length, 0)
})

test("client records consent before one fix, sends rounded coordinates and withdraws", async () => {
  const f = clientFixture({ request: (body, _calls, fixes) => {
    if (body.action === "grant") assert.equal(fixes.length, 0)
    return Response.json(body.action === "grant" ? { receipt: "test" } : body.action === "resolve" ? { pincode: "560027" } : { success: true })
  } })
  assert.equal(await f.client.detectDeliveryPincode(true, new AbortController().signal), "560027")
  assert.deepEqual(f.calls.map(call => call.action), ["grant", "resolve", "withdraw"])
  assert.equal(f.calls[1].latitude, 12.972)
  assert.equal(f.calls[1].longitude, 77.595)
  assert.equal(f.fixes.length, 1)
  assert.equal(f.fixes[0].enableHighAccuracy, false)
  assert.equal(f.fixes[0].maximumAge, 0)
})

test("permission denial withdraws consent and never sends coordinates", async () => {
  const f = clientFixture({ position: (_ok, fail) => fail({ code: 1 }) })
  await assert.rejects(f.client.detectDeliveryPincode(true, new AbortController().signal), /permission was denied/)
  assert.deepEqual(f.calls.map(call => call.action), ["grant", "withdraw"])
})

test("cancelling during consent or location acquisition ignores late fixes and withdraws", async () => {
  const controller = new AbortController()
  const f = clientFixture({ request: body => {
    if (body.action === "grant") controller.abort()
    return Response.json({ receipt: "test" })
  } })
  await assert.rejects(f.client.detectDeliveryPincode(true, controller.signal))
  assert.equal(f.fixes.length, 0)
  assert.deepEqual(f.calls.map(call => call.action), ["grant", "withdraw"])
  const pendingController = new AbortController()
  let lateFix
  const pending = clientFixture({ position: ok => { lateFix = ok; pendingController.abort() } })
  await assert.rejects(pending.client.detectDeliveryPincode(true, pendingController.signal))
  lateFix({ coords: { latitude: 12, longitude: 77 } })
  assert.deepEqual(pending.calls.map(call => call.action), ["grant", "withdraw"])
})
