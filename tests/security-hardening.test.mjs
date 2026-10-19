import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
import { sourceLoader } from "./source-loader.mjs"

const readSource = file => fs.readFileSync(path.resolve(import.meta.dirname, "..", file), "utf8")

/**
 * Pins the abuse-prevention fixes so they cannot be quietly reverted. Each of
 * these was a live hole: a spoofable rate-limit key, two auth endpoints that
 * opted out of the only per-IP counter, unauthenticated order lookup by email
 * or phone, and a mail endpoint that would send to any string.
 *
 * Nothing here opens a socket, a database connection or an SMTP transport.
 */

test("client address ignores headers the caller can set themselves", () => {
  const { clientAddress } = sourceLoader().load("lib/client-address.ts")
  const req = headers => ({ headers: new Headers(headers) })

  // The platform header wins over anything the caller supplies.
  assert.equal(
    clientAddress(req({
      "x-vercel-forwarded-for": "203.0.113.9",
      "cf-connecting-ip": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
      "x-forwarded-for": "3.3.3.3",
    })),
    "203.0.113.9",
  )

  // Without it, only the rightmost x-forwarded-for entry is trustworthy: the
  // caller controls everything to the left of what the nearest proxy appends.
  assert.equal(clientAddress(req({ "x-forwarded-for": "9.9.9.9, 198.51.100.4" })), "198.51.100.4")

  // Spoofing these must not mint a fresh bucket per request.
  assert.equal(clientAddress(req({ "cf-connecting-ip": "1.2.3.4" })), "unknown")
  assert.equal(clientAddress(req({ "x-real-ip": "1.2.3.4" })), "unknown")
  assert.equal(clientAddress(req({})), "unknown")
})

test("client address trusts Cloudflare only when the deployment declares it", () => {
  const loader = sourceLoader({}, { env: { TRUST_CLOUDFLARE_IP: "true" } })
  const { clientAddress } = loader.load("lib/client-address.ts")
  assert.equal(clientAddress({ headers: new Headers({ "cf-connecting-ip": "1.2.3.4" }) }), "1.2.3.4")
})

test("partner CORS does not trust loopback origins in production", () => {
  // These origins are reflected with Access-Control-Allow-Credentials, so in
  // production they would let any page a victim serves on their own machine
  // call the live partner API as them.
  const headersFor = (nodeEnv, origin, allowlist) => {
    const loader = sourceLoader(
      { "@/lib/partner/rate-limit": { checkPartnerRateLimit: async () => ({ allowed: true }) } },
      { env: { NODE_ENV: nodeEnv, PARTNER_ALLOWED_ORIGINS: allowlist } },
    )
    return loader.load("lib/partner/auth.ts").getCorsHeaders(origin)
  }
  const loopback = "http://localhost:3000"
  assert.equal(headersFor("development", loopback)["Access-Control-Allow-Origin"], loopback)
  assert.equal(headersFor("production", loopback)["Access-Control-Allow-Origin"], undefined)

  // The deployed allowlist must not be able to put them back, because a
  // development value promoted to production would reopen the same hole.
  assert.equal(headersFor("production", loopback, loopback)["Access-Control-Allow-Origin"], undefined)
  assert.equal(
    headersFor("production", "https://partner.example.net", "https://partner.example.net")["Access-Control-Allow-Origin"],
    "https://partner.example.net",
  )
})

test("login and signup keep the per-IP attempt counter enabled", () => {
  // reCAPTCHA is off whenever RECAPTCHA_ENABLED is not "true", so this counter
  // is the only thing standing between an attacker and unlimited credential
  // stuffing against bcrypt hashes.
  for (const route of ["app/api/auth/login/route.ts", "app/api/auth/signup/route.ts"]) {
    const source = readSource(route)
    assert.ok(!/skipRateLimit:\s*true/.test(source), `${route} must not pass skipRateLimit: true`)
    assert.ok(/detectBot\(/.test(source), `${route} must still run bot detection`)
  }
})

test("order tracking never matches on a customer email or phone number", async () => {
  const queries = []
  const order = {
    _id: "fixture-order",
    orderId: "SARAECOM-00100001",
    status: "shipped",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    customer: { email: "victim@example.invalid", phone: "9876543210" },
  }
  const collection = {
    findOne: async query => {
      queries.push(query)
      return query.$or?.some(c => c.orderId === order.orderId) ? order : null
    },
  }
  const route = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => collection } }) },
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: true }) },
  }).load("app/api/orders/track/route.ts")

  const track = value =>
    route.GET(new Request(`https://fixture.invalid/api/orders/track?orderId=${encodeURIComponent(value)}`))

  // A real order ID still resolves.
  assert.equal((await track(order.orderId)).status, 200)

  // Knowing the shopper's email address or mobile number must not.
  assert.equal((await track(order.customer.email)).status, 404)
  assert.equal((await track(order.customer.phone)).status, 404)

  const conditions = queries.flatMap(query => query.$or ?? [])
  assert.ok(!conditions.some(c => "customer.email" in c), "must not query customer.email")
  assert.ok(!conditions.some(c => "customer.phone" in c), "must not query customer.phone")
})

test("order tracking refuses to answer once the caller exceeds its budget", async () => {
  const route = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => { throw new Error("must not reach the database") } },
    "@/lib/rate-limit": { checkRateLimit: async () => ({ success: false, retryAfter: 42 }) },
  }).load("app/api/orders/track/route.ts")

  const response = await route.GET(new Request("https://fixture.invalid/api/orders/track?orderId=SARAECOM-1"))
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("retry-after"), "42")
})

test("the contact endpoint will not relay mail to a malformed recipient", async () => {
  const sent = []
  const loader = sourceLoader({
    "@/lib/email": { sendEmail: async message => { sent.push(message); return { success: true } } },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/db-service": { getCollection: async () => ({ insertOne: async () => ({}) }) },
  })
  const route = loader.load("app/api/contact/route.ts")
  const post = body =>
    route.POST(new Request("https://fixture.invalid/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }))

  const valid = { name: "Asha", email: "asha@example.invalid", subject: "Order query", message: "Where is my order?" }
  assert.equal((await post(valid)).status, 200)
  assert.equal(sent.at(-1).to, valid.email)

  sent.length = 0
  for (const bad of [
    { ...valid, email: "not-an-email" },
    { ...valid, email: "victim@example.invalid\nBcc: everyone@example.invalid" },
    { ...valid, message: "hi" },
    { ...valid, name: "" },
  ]) {
    assert.equal((await post(bad)).status, 400)
  }
  assert.equal(sent.length, 0, "no mail may be sent for a rejected submission")
})

test("signup answers identically whether or not the address already has an account", async () => {
  const mail = []
  const existing = { _id: "u1", email: "taken@example.invalid" }

  const buildRoute = () => {
    const users = {
      findOne: async (query) => (query.email === existing.email ? existing : null),
      insertOne: async () => ({ insertedId: { toString: () => "new-user-id" } }),
    }
    return sourceLoader({
      "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => users } }) },
      "@/lib/botDetection": {
        detectBot: async () => ({ isBot: false }),
        getClientIP: () => "1.2.3.4",
        resetRateLimit: async () => {},
        formatWait: () => "1 minute",
      },
      "@/lib/consent": { recordConsent: async () => {}, CONSENT_PURPOSES: { ACCOUNT: "a", MARKETING_EMAIL: "b", MARKETING_WHATSAPP: "c", MARKETING_SMS: "d" } },
      "@/lib/profile-avatars": { defaultProfileAvatar: () => "/avatar.png" },
      "@/lib/email": { sendEmail: async (m) => { mail.push(m); return { success: true } }, getRegistrationEmailTemplate: () => "" },
      bcryptjs: { hash: async () => "hashed" },
    }).load("app/api/auth/signup/route.ts")
  }

  const submit = (route, email) =>
    route.POST(new Request("https://fixture.invalid/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Asha Patel",
        email,
        password: "Str0ng!Passw0rd",
        confirmPassword: "Str0ng!Passw0rd",
        acceptTerms: true,
        acceptPrivacyNotice: true,
      }),
    }))

  const taken = await submit(buildRoute(), existing.email)
  const fresh = await submit(buildRoute(), "brand-new@example.invalid")

  // Status, body and field set must all match; any difference re-identifies
  // the address for an attacker enumerating a list.
  assert.equal(taken.status, fresh.status)
  const takenBody = await taken.json()
  const freshBody = await fresh.json()
  assert.deepEqual(takenBody, freshBody)
  assert.ok(!("user" in takenBody), "must not return a user object")
  assert.ok(
    !/exist|already|registered account/i.test(JSON.stringify(takenBody)),
    "the message must not hint that the account exists",
  )

  // The fact is disclosed only to the account holder.
  const notice = mail.find((m) => m.to === existing.email && /tried to create an account/i.test(m.subject))
  assert.ok(notice, "the existing account owner should be told someone tried to register")
})

test("getCampaignCollection re-checks the slug instead of trusting its caller", async () => {
  // Several public routes take the campaign id straight from the request body,
  // and the slug becomes part of a collection name. Validating here means a
  // caller that forgets resolveCampaignSlug still cannot name a collection.
  let named = null
  const { getCampaignCollection } = sourceLoader({
    "@/lib/mongodb": {
      connectToDatabase: async () => ({ db: { collection: name => { named = name; return {} } } }),
    },
  }).load("lib/spin-wheel-campaigns.ts")

  await getCampaignCollection("diwali-2026", "visits")
  assert.equal(named, "spin_diwali-2026_visits")

  for (const bad of ["../admin", "a$b", "a.b", "system.indexes"]) {
    named = null
    await assert.rejects(() => getCampaignCollection(bad, "visits"), /Invalid campaign id/)
    assert.equal(named, null, `must not reach the database for ${bad}`)
  }
})

test("anonymous write endpoints all carry a request budget", () => {
  /*
   * Each of these persists a document for an unauthenticated caller, so the
   * budget is the only thing bounding how much storage one caller can consume
   * — and for the OTP route, how much money, since every send is a real
   * WhatsApp message and a real email.
   */
  for (const route of [
    "app/api/vitals/route.ts",
    "app/api/events/route.ts",
    "app/api/consent/tracking/route.ts",
    "app/api/spin-wheel/track/route.ts",
    "app/api/spin-wheel/otp/send/route.ts",
  ]) {
    const source = readSource(route)
    assert.match(source, /withRateLimit|checkRateLimit|rateLimitHit/, `${route} must bound anonymous writes`)
  }

  // The OTP budget has to be keyed on the caller as well as the phone number.
  // Per-phone alone lets someone walk a list of numbers, spending real
  // messages on each victim.
  const otpSend = readSource("app/api/spin-wheel/otp/send/route.ts")
  assert.match(otpSend, /clientAddress\(request\)/, "the OTP budget must also be per-caller")
})

test("the vitals beacon only stores metrics a dashboard can group", () => {
  const source = readSource("app/api/vitals/route.ts")
  // A free-form metric name lets an anonymous caller fill the collection with
  // rows nothing can aggregate, which is worse than dropping them.
  assert.match(source, /z\.enum\(\s*\[\s*"CLS"/, "metric names must be allow-listed")
  assert.match(source, /safeParse/, "the body must be validated")
})

test("the public event sink cannot store keys that break the collection", () => {
  const source = readSource("app/api/events/route.ts")
  // Keys arrive from an anonymous caller. A key starting with "$" or holding a
  // "." inserts fine but makes the document unqueryable on that very field.
  assert.match(source, /startsWith\("\$"\)/, "must drop operator-prefixed keys")
  assert.match(source, /includes\("\."\)/, "must drop dotted keys")
})

test("a campaign id that is not a plain slug never reaches a collection name", () => {
  const { resolveCampaignSlug } = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => { throw new Error("not needed") } },
  }).load("lib/spin-wheel-campaigns.ts")

  assert.equal(resolveCampaignSlug(undefined), "default")
  assert.equal(resolveCampaignSlug(""), "default")
  assert.equal(resolveCampaignSlug("diwali-2026"), "diwali-2026")
  assert.equal(resolveCampaignSlug("  Diwali-2026  "), "diwali-2026")

  // The slug is interpolated into `spin_<slug>_<collection>`, so anything that
  // is not [a-z0-9-] would let an anonymous caller name a new collection.
  for (const bad of ["../admin", "a b", "a$b", "a.b", "x".repeat(61), {}, 42, ["a"]]) {
    assert.equal(resolveCampaignSlug(bad), null, `must reject ${JSON.stringify(bad)}`)
  }
})

test("spinning requires the token issued at registration", async () => {
  const participant = {
    _id: "6500000000000000000000aa",
    phone: "9876543210",
    hasSpun: false,
    spinToken: "the-real-token",
  }
  const collections = {
    participants: { findOne: async () => participant },
    inventory: { find: () => ({ toArray: async () => [] }) },
    couponCodes: {},
  }
  const route = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: {} }) },
    "@/lib/spin-wheel-notifications": { sendSpinWheelEmail: async () => {}, sendWhatsAppWinNotification: async () => {} },
    "@/lib/spin-wheel-campaigns": {
      resolveCampaignSlug: value => (value === undefined || value === "" ? "default" : /^[a-z0-9-]{1,60}$/.test(value) ? value : null),
      getCampaignCollection: async (_slug, name) => collections[name],
    },
    mongodb: { ObjectId: class { constructor(value) { this.value = value } } },
  }).load("app/api/spin-wheel/spin/route.ts")

  const spin = body =>
    route.POST(new Request("https://fixture.invalid/api/spin-wheel/spin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }))

  // Holding only the participant id is not enough to spend someone's spin.
  assert.equal((await spin({ participantId: participant._id })).status, 403)
  assert.equal((await spin({ participantId: participant._id, spinToken: "guess" })).status, 403)

  // A malformed campaign is rejected before any collection is touched.
  assert.equal((await spin({ participantId: participant._id, campaignId: "a$b" })).status, 400)

  // The real token gets past the ownership check (inventory is empty here, so
  // the request fails later for an unrelated reason — not 403).
  assert.notEqual((await spin({ participantId: participant._id, spinToken: participant.spinToken })).status, 403)
})

test("the spin-wheel verification token comes from a CSPRNG", () => {
  const source = readSource("app/api/spin-wheel/otp/verify/route.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
  assert.ok(/randomBytes\(/.test(source), "must mint the token with crypto.randomBytes")
  assert.ok(!/Math\.random/.test(source), "Math.random is predictable from observed output")
})

test("the spin-wheel prize draw comes from a CSPRNG", () => {
  // The draw hands out real coupons, so a predictable PRNG lets someone time
  // their spin to land on the prize they want.
  const source = readSource("app/api/spin-wheel/spin/route.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
  assert.ok(/randomInt\(/.test(source), "must draw with crypto.randomInt")
  assert.ok(!/Math\.random/.test(source), "Math.random is recoverable from observed draws")
})

test("partner rate limiting counts against the shared store", async () => {
  /*
   * A module-scoped Map resets on every cold start and is never shared across
   * warm instances, so the limit a partner actually hits is `limit x
   * instances`. The budget has to live in the same durable store as the rest
   * of the app.
   */
  const source = readSource("lib/partner/rate-limit.ts")
  assert.ok(!/setInterval\(/.test(source), "a per-instance sweep timer means per-instance counters")
  assert.ok(!/new Map</.test(source), "counters must not live in module memory")

  const seen = []
  const { checkPartnerRateLimit } = sourceLoader({
    "@/lib/rate-limit-store": {
      rateLimitHit: async (key, limit, windowMs) => {
        seen.push({ key, limit, windowMs })
        // Blow the daily budget only, so retryAfter must prefer it.
        const daily = key.endsWith(":daily")
        return { limited: daily, remaining: daily ? 0 : 7, resetSeconds: daily ? 3600 : 30 }
      },
      rateLimitReset: async () => {},
    },
  }).load("lib/partner/rate-limit.ts")

  const result = await checkPartnerRateLimit("key-1", "starter", "/api/v1/partner/products")

  assert.equal(result.allowed, false)
  assert.equal(result.retryAfter, 3600, "the daily window is the one worth waiting on")
  assert.deepEqual(
    seen.map(s => s.windowMs),
    [60 * 1000, 24 * 60 * 60 * 1000],
    "one per-minute budget and one per-day budget",
  )
  // The minute budget stays scoped to the endpoint, the daily one to the key.
  assert.ok(seen[0].key.includes("/api/v1/partner/products"))
  assert.ok(seen[1].key.endsWith(":daily"))
})

test("stored media is only ever served as a picture", () => {
  const { servableImageType } = sourceLoader().load("lib/media.ts")

  // An admin-stored data:text/html would otherwise be same-origin HTML served
  // from our own domain, which nosniff does not prevent.
  assert.equal(servableImageType("text/html"), null)
  assert.equal(servableImageType("application/javascript"), null)
  assert.equal(servableImageType("application/octet-stream"), null)

  assert.equal(servableImageType("image/png"), "image/png")
  assert.equal(servableImageType("IMAGE/PNG"), "image/png")
  assert.equal(servableImageType("image/webp; charset=utf-8"), "image/webp")

  // SVG is allowed but the route sandboxes it, since script inside one runs
  // when the URL is opened directly.
  assert.equal(servableImageType("image/svg+xml"), "image/svg+xml")
  const route = readSource("app/api/media/[type]/[id]/route.ts")
  assert.ok(/servableImageType/.test(route), "the route must apply the allowlist")
  assert.ok(/Content-Security-Policy/.test(route) && /sandbox/.test(route), "SVG must be sandboxed")
})

test("every password write uses the same bcrypt cost", () => {
  // Resetting a password must not silently weaken the hash it replaces.
  const files = [
    "app/api/auth/signup/route.ts",
    "app/api/auth/reset-password/route.ts",
    "app/api/users/route.ts",
    "lib/employee-service.ts",
  ]
  for (const file of files) {
    const costs = [...readSource(file).matchAll(/bcrypt\.hash\([^,]+,\s*(\d+)\)/g)].map(m => Number(m[1]))
    assert.ok(costs.length > 0, `${file} should hash a password`)
    for (const cost of costs) assert.equal(cost, 12, `${file} hashes at cost ${cost}, expected 12`)
  }
})
