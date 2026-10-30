import assert from "node:assert/strict"
import test from "node:test"
import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"

// Only synthetic records; the source loader refuses real DB/provider access.
const password = `Aa1!${crypto.randomBytes(16).toString("hex")}`
const passwordHash = await bcrypt.hash(password, 4) // Fixture setup, not a production write.
const accountId = new ObjectId()
const account = { _id: accountId, name: "Auth Fixture", email: "auth@example.invalid", password: passwordHash,
  role: "user", status: "active", emailVerified: true, sessionVersion: 0 }
const silentConsole = () => {
  const messages = []
  return { messages, logger: Object.fromEntries(["log", "warn", "error", "info"].map(name => [name,
    (...args) => messages.push(args.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" "))])) }
}
const isDate = value => Object.prototype.toString.call(value) === "[object Date]"
const storedFields = value => Object.fromEntries(Object.entries(value || {}).map(([key, item]) => [key, isDate(item) ? new Date(Number(item)) : item]))
function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record[key]
    if (expected && typeof expected === "object" && !(expected instanceof ObjectId) && !isDate(expected)) {
      if ("$gt" in expected) return actual != null && Number(actual) > Number(expected.$gt)
      if ("$exists" in expected) return (actual !== undefined) === expected.$exists
    }
    if (isDate(expected)) return Number(actual) === Number(expected)
    return actual === expected || (actual instanceof ObjectId && expected instanceof ObjectId && actual.equals(expected))
  })
}
function harness({ record = account, env = {} } = {}) {
  const records = record ? [{ ...record }] : []
  const mail = [], consents = [], revoked = [], queries = [], updates = [], rateHits = []
  const counts = new Map()
  const revokedSessions = new Map()
  const state = { token: undefined, bearer: undefined, path: "/api/admin/dashboard", limitFailure: null,
    revocationWriteFailure: null, revocationReadFailure: null, refreshRevocationFailure: null,
    emailIndexFailure: null, emailIndexReady: false, emailIndexes: [], emailInsertCollisions: 0 }
  const output = silentConsole()
  const users = {
    async createIndex(keys, options) {
      if (state.emailIndexFailure) throw state.emailIndexFailure
      state.emailIndexes.push({ keys, options }); state.emailIndexReady = true
      return options.name
    },
    async findOne(filter, options) {
      queries.push(filter)
      return records.find(row => options?.collation && typeof filter.email === "string"
        ? row.email.toLowerCase() === filter.email.toLowerCase() : matches(row, filter)) ?? null
    },
    async insertOne(row) {
      if (state.emailIndexReady && records.some(existing => existing.email.toLowerCase() === row.email.toLowerCase())) {
        state.emailInsertCollisions++
        throw Object.assign(new Error("Fixture duplicate email"), { code: 11000, keyPattern: { email: 1 } })
      }
      const insertedId = new ObjectId(); records.push({ ...storedFields(row), _id: insertedId }); return { insertedId }
    },
    async updateOne(filter, mutation) {
      updates.push({ filter, mutation })
      const row = records.find(value => matches(value, filter))
      if (!row) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
      Object.assign(row, storedFields(mutation.$set))
      for (const key of Object.keys(mutation.$unset || {})) delete row[key]
      for (const [key, value] of Object.entries(mutation.$inc || {})) row[key] = (row[key] || 0) + value
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
    },
  }
  const sessions = {
    async findOne(filter) {
      if (state.revocationReadFailure) throw state.revocationReadFailure
      const row = revokedSessions.get(filter._id)
      return row && matches(row, filter) ? row : null
    },
    async updateOne(filter, mutation) {
      if (state.revocationWriteFailure) throw state.revocationWriteFailure
      if (!revokedSessions.has(filter._id)) revokedSessions.set(filter._id, { _id: filter._id, ...storedFields(mutation.$setOnInsert) })
      return { acknowledged: true, matchedCount: 1 }
    },
  }
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection(name) {
      if (name === "revoked_sessions") return sessions
      assert.equal(name, "users", `Unexpected fixture collection: ${name}`); return users
    } } }) },
    "next/headers": {
      cookies: async () => ({ get: name => name === "session" && state.token ? { value: state.token } : undefined }),
      headers: async () => new Headers({ "x-sara-request-path": state.path,
        ...(state.bearer ? { authorization: `Bearer ${state.bearer}` } : {}) }),
    },
    "@/lib/rate-limit-store": {
      async rateLimitHit(key, max, windowMs) {
        if (state.limitFailure) throw state.limitFailure
        rateHits.push({ key, max, windowMs })
        const count = (counts.get(key) || 0) + 1; counts.set(key, count)
        return { limited: count > max, remaining: Math.max(0, max - count), resetSeconds: Math.ceil(windowMs / 1000) }
      },
      rateLimitReset: async key => counts.delete(key), rateLimitResetSeconds: async () => 60,
    },
    "@/lib/smtp": { verifyEmailTransport: async () => {}, EmailConfigurationError: class extends Error {} },
    "@/lib/email": { sendEmail: async message => { mail.push(message); return { success: true } },
      storefrontOrigin: () => "https://shop.example.invalid", buildPasswordResetEmail: url => `<a href="${url}">Reset</a>` },
    "@/lib/consent": { recordConsent: async data => consents.push(data),
      CONSENT_PURPOSES: { ACCOUNT: "account", MARKETING_EMAIL: "email", MARKETING_WHATSAPP: "whatsapp", MARKETING_SMS: "sms" } },
    "@/lib/refresh-tokens": {
      revokeAllForUser: async (...args) => {
        if (state.refreshRevocationFailure) throw state.refreshRevocationFailure
        revoked.push(args); return 1
      },
      revokeRefreshToken: async (...args) => { revoked.push(args); return true },
    },
  }, { env: { NODE_ENV: "production", RECAPTCHA_ENABLED: "false", NEXT_PUBLIC_SITE_URL: "https://shop.example.invalid", ...env },
    context: { console: output.logger } })
  const request = (body, route = "/api/auth/login", extraHeaders = {}, method = "POST") => new NextRequest(`https://shop.example.invalid${route}`, {
    method, headers: { "content-type": "application/json", "user-agent": "Auth Fixture Browser",
      "x-forwarded-for": "198.51.100.23", ...extraHeaders }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  })
  const login = (body = { email: account.email, password }, headers) => loader.load("app/api/auth/login/route.ts").POST(request(body, undefined, headers))
  const adopt = response => { state.token = response.cookies.get("session")?.value; return state.token }
  return { loader, state, records, mail, consents, revoked, revokedSessions, queries, updates, rateHits, counts, output, request, login, adopt,
    session: () => loader.load("lib/auth.ts").getSession() }
}

const registration = overrides => ({ email: "new@example.com", name: "New Fixture", password, confirmPassword: password,
  acceptTerms: true, acceptPrivacyNotice: true, ...overrides })

const identity = sourceLoader().load("lib/registration-validation.ts")
const meaninglessName = "sdfksfgksjfygdkfghdkdfgkfdhgsdfgkhfgudfgkfghdfhgsdfugs"
const exampleEmail = "dfgjdfkgdfdk@hjdfhgdfgkjdf.csdfsdfsdf"
const reportedInvalidNames = ["asdfghjkl", "qwertyuiop", "zxcvbnm", "sdfksfgksjfygdkfgh", "HJguygu",
  "aaaaaaaaaaaaaaaa", "xxxxxxxxxxxxxxxx", "testtesttest", "John123", "Admin999", "null", "undefined", "NaN",
  "true", "false", "hello_world", "hello-world"]

for (const name of reportedInvalidNames) {
  test(`reported invalid name fails shared validation and direct signup: ${name}`, async () => {
    assert.equal(identity.registrationNameSchema.safeParse(name).success, false)
    const app = harness(); const response = await app.loader.load("app/api/auth/signup/route.ts").POST(
      app.request(registration({ name }), "/api/auth/signup"))
    assert.equal(response.status, 400); assert.equal(app.records.length, 1)
    assert.equal(app.state.emailIndexes.length, 0); assert.equal(app.mail.length, 0)
    assert.ok((await response.json()).fieldErrors.name)
  })
}

test("obvious name patterns are normalized without rejecting ordinary similar names", () => {
  for (const name of [" QWERTYUIOP ", "NULL", "Hello World", "TEST-TEST-TEST", "poiuytrewq", "qwerty"]) {
    assert.equal(identity.registrationNameSchema.safeParse(name).success, false)
  }
  for (const name of ["Jean-Luc", "McDonald", "OBrien", "Nana", "Anna", "Testa", "Nan", "Trueba", "Rhys", "Ng"]) {
    assert.equal(identity.registrationNameSchema.safeParse(name).success, true, name)
  }
})

for (const name of ["李", "李 雷", "José Álvarez", "Łukasz Żółć", "O’Neill", "Jean-Luc", "D'Arcy", "J. R. R. Tolkien",
  "ಅನನ್ಯ ಗೌಡ", "किरण शर्मा", "أحمد محمد", "محمد\u200Cرضا", "Ng", "Rhys", "Wolfeschlegelsteinhausenbergerdorff", "Avery"]) {
  test(`registration accepts legitimate name forms: ${name}`, () => {
    assert.equal(identity.registrationNameSchema.parse(name), name)
  })
}

for (const [label, name] of [["empty", ""], ["whitespace", " \t\n "], ["punctuation", "---"], ["modifier apostrophes", "ʼʼ"],
  ["digits", "Customer123"], ["markup", "<b>Asha</b>"], ["emoji", "Asha 😀"], ["invalid separators", "A--B"],
  ["leading joiner", "\u200CAsha"], ["trailing joiner", "Asha\u200D"],
  ["overlong", "Ab ".repeat(34)], ["repeated letters", "A".repeat(40)], ["provided random-looking example", meaninglessName]]) {
  test(`registration rejects invalid names: ${label}`, () => {
    assert.equal(identity.registrationNameSchema.safeParse(name).success, false)
  })
}

test("name normalization trims and composes Unicode without erasing internal word spaces", () => {
  assert.equal(identity.registrationNameSchema.parse("  Jose\u0301   A\u0301lvarez  "), "José Álvarez")
  const atLimit = "Ab ".repeat(33) + "C"
  assert.equal(atLimit.length, 100); assert.equal(identity.registrationNameSchema.parse(atLimit), atLimit)
})

test("legitimate apostrophe prefixes are accepted in names", () => {
  for (const name of ["Gerard ’t Hooft", "'t Hooft"]) assert.equal(identity.registrationNameSchema.parse(name), name)
})

test("repeated modifier apostrophes and oversized names are rejected with bounded character checks", () => {
  for (const name of ["A" + "ʼ".repeat(95) + "!", "A" + "ʼ".repeat(100000) + "!", "Ab ".repeat(100000)]) {
    assert.equal(identity.registrationNameSchema.safeParse(name).success, false)
  }
})

for (const email of ["customer@example.com", "customer+orders@mail.example.co.uk", "o'connor@example.travel",
  "customer@example.museum", "customer@example.photography", "customer@例え.jp", "customer@example.xn--p1ai", "customer@co.uk"]) {
  test(`registration accepts valid public-domain email structures: ${email}`, () => {
    assert.equal(identity.registrationEmailSchema.safeParse(email).success, true)
  })
}

for (const [label, email] of [["provided suffix", exampleEmail], ["empty", ""], ["whitespace", "  "], ["no at", "example.com"],
  ["two ats", "a@@example.com"], ["consecutive dots", "a..b@example.com"], ["missing local part", "@example.com"],
  ["space", "a b@example.com"], ["leading domain hyphen", "a@-example.com"], ["trailing domain hyphen", "a@example-.com"],
  ["empty domain label", "a@example..com"], ["long domain label", `a@${"a".repeat(64)}.com`],
  ["long local part", `${"a".repeat(65)}@example.com`], ["numeric suffix", "a@example.123"],
  ["private hostname", "a@localhost"], ["IP", "a@127.0.0.1"],
  ["domain port", "a@example.com:443"], ["URL escape", "a@ex%61mple.com"], ["URL path", "a@example.com/path"],
  ["trailing domain dot", "a@example.com."], ["overlong address", `a@${("a".repeat(62) + ".").repeat(4)}com`]]) {
  test(`registration rejects malformed email/domain input: ${label}`, () => {
    assert.equal(identity.registrationEmailSchema.safeParse(email).success, false)
  })
}

test("email normalization lowercases, trims and canonicalizes international domains without alias rewriting", () => {
  assert.equal(identity.registrationEmailSchema.parse("  Customer+Orders@例え.JP  "), "customer+orders@xn--r8jz45g.jp")
  assert.equal(identity.registrationEmailSchema.parse("First.Last+tag@EXAMPLE.COM"), "first.last+tag@example.com")
})

test("valid email syntax does not establish mailbox ownership", async () => {
  const app = harness(); const response = await app.loader.load("app/api/auth/signup/route.ts").POST(
    app.request(registration({ email: "unproven-inbox@unproven-domain-123456.com" }), "/api/auth/signup"))
  assert.equal(response.status, 200)
  const created = app.records.find(row => row.email === "unproven-inbox@unproven-domain-123456.com")
  assert.equal(created.emailVerified, false)
})

for (const change of [{ name: meaninglessName }, { email: exampleEmail }, { name: "  " }, { name: "Ab ".repeat(34) }]) {
  test(`direct signup API rejects invalid identity before index, hash or account writes: ${Object.keys(change)[0]} ${String(Object.values(change)[0]).slice(0, 12)}`, async () => {
    const app = harness(); const response = await app.loader.load("app/api/auth/signup/route.ts").POST(app.request(registration(change), "/api/auth/signup"))
    assert.equal(response.status, 400); assert.equal(app.records.length, 1)
    assert.equal(app.state.emailIndexes.length, 0); assert.equal(app.mail.length, 0); assert.equal(app.consents.length, 0)
    assert.ok((await response.json()).fieldErrors[Object.keys(change)[0]])
  })
}

test("concurrent normalized registrations create exactly one account and one verification email", async () => {
  const app = harness(); const signup = app.loader.load("app/api/auth/signup/route.ts").POST
  const results = await Promise.all([
    signup(app.request(registration({ name: "  José   Álvarez  ", email: " RACE@EXAMPLE.COM " }), "/api/auth/signup")),
    signup(app.request(registration({ email: "race@example.com" }), "/api/auth/signup")),
  ])
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409])
  const loser = results.find(response => response.status === 409)
  assert.equal((await loser.json()).code, "EMAIL_EXISTS")
  assert.equal(app.records.filter(row => row.email === "race@example.com").length, 1)
  assert.equal(app.mail.length, 1); assert.equal(app.consents.length, 1)
  assert.equal(app.state.emailInsertCollisions, 1, "Both requests must reach insert so the database collision path is exercised")
  assert.equal(app.state.emailIndexes[0].options.unique, true)
  assert.equal(app.state.emailIndexes[0].options.collation.strength, 2)
})

test("legacy uppercase accounts are duplicates under the database email collation", async () => {
  const app = harness({ record: { ...account, email: "LEGACY@EXAMPLE.COM" } })
  const response = await app.loader.load("app/api/auth/signup/route.ts").POST(app.request(registration({ email: "legacy@example.com" }), "/api/auth/signup"))
  assert.equal(response.status, 409); assert.equal(app.records.length, 1); assert.equal(app.mail.length, 0)
})

test("unavailable uniqueness enforcement fails closed rather than registering duplicates", async () => {
  const app = harness(); app.state.emailIndexFailure = Object.assign(new Error("Fixture legacy duplicates"), { code: 11000 })
  const response = await app.loader.load("app/api/auth/signup/route.ts").POST(app.request(registration(), "/api/auth/signup"))
  assert.equal(response.status, 503); assert.equal(response.headers.get("retry-after"), "60")
  assert.equal(app.records.length, 1); assert.equal(app.mail.length, 0); assert.equal(app.queries.length, 0)
})

test("only email index collisions are classified as duplicate accounts", () => {
  const { isDuplicateAccountEmail } = sourceLoader().load("lib/account-email-index.ts")
  assert.equal(isDuplicateAccountEmail({ code: 11000, keyPattern: { email: 1 } }), true)
  assert.equal(isDuplicateAccountEmail({ code: 11000, message: "index: email_case_insensitive_unique dup key" }), true)
  assert.equal(isDuplicateAccountEmail({ code: 11000, keyPattern: { _id: 1 } }), false)
  assert.equal(isDuplicateAccountEmail({ code: 12345, keyPattern: { email: 1 } }), false)
})

test("server stores normalized international names and domain names", async () => {
  const app = harness(); const response = await app.loader.load("app/api/auth/signup/route.ts").POST(
    app.request(registration({ name: "  Jose\u0301   A\u0301lvarez ", email: "CUSTOMER@例え.JP " }), "/api/auth/signup"))
  assert.equal(response.status, 200)
  const created = app.records.find(row => row.email === "customer@xn--r8jz45g.jp")
  assert.equal(created.name, "José Álvarez"); assert.equal(created.emailVerified, false)
  const login = await app.login({ email: " CUSTOMER@例え.JP ", password })
  assert.equal(login.status, 200); app.adopt(login); assert.ok(await app.session())
  const recovery = await app.loader.load("app/api/auth/forgot-password/route.ts").POST(app.request({ email: " CUSTOMER@例え.JP " }, "/api/auth/forgot-password"))
  assert.equal(recovery.status, 200); assert.ok(created.resetPasswordToken)
})

test("valid credentials issue a production cookie and establish a live-user session", async () => {
  const app = harness(); const response = await app.login(); assert.equal(response.status, 200)
  const token = app.adopt(response); assert.ok(token)
  assert.equal((await app.session()).user.id, accountId.toString())
  const body = await response.json()
  assert.equal(body.user.email, account.email); assert.equal(body.user.role, "user")
  assert.equal(body.user.password, undefined); assert.equal(body.token, undefined)
  assert.equal(body.user.emailVerificationToken, undefined)
})

for (const [label, record, input] of [
  ["incorrect password", account, { email: account.email, password: "Wrong-password-1!" }],
  ["nonexistent user", null, { email: "missing@example.invalid", password }],
]) test(`login rejects ${label} without issuing session cookies`, async () => {
  const app = harness({ record }); const response = await app.login(input)
  assert.equal(response.status, 401); assert.equal(response.cookies.get("session"), undefined)
  assert.equal((await response.json()).message, "Invalid email or password")
})

for (const status of ["inactive", "deleted"]) test(`login rejects ${status} accounts`, async () => {
  const app = harness({ record: { ...account, status } }); assert.equal((await app.login()).status, 403)
})

for (const body of [{ email: "invalid", password }, { email: account.email }, { email: account.email, password: {} }]) {
  test(`login rejects malformed input: ${JSON.stringify(Object.keys(body))}`, async () => {
    const app = harness(); assert.equal((await app.login(body)).status, 400); assert.equal(app.queries.length, 0)
  })
}

test("registration is implemented, hashes the password and does not auto-login or leak credentials", async () => {
  const app = harness(); const response = await app.loader.load("app/api/auth/signup/route.ts").POST(app.request(registration(), "/api/auth/signup"))
  assert.equal(response.status, 200); assert.equal((await response.json()).success, true)
  const created = app.records.find(row => row.email === "new@example.com")
  assert.ok(created); assert.notEqual(created.password, password); assert.equal(bcrypt.getRounds(created.password), 12)
  assert.equal(await bcrypt.compare(password, created.password), true)
  assert.equal(created.role, "user"); assert.equal(created.emailVerified, false)
  assert.equal(response.cookies.get("session"), undefined); assert.equal(app.mail.length, 1); assert.equal(app.consents.length, 1)
})

test("duplicate registration returns 409 without another account or verification email", async () => {
  const app = harness({ record: { ...account, email: "existing@example.com" } }); const response = await app.loader.load("app/api/auth/signup/route.ts").POST(
    app.request(registration({ email: "EXISTING@EXAMPLE.COM" }), "/api/auth/signup"))
  assert.equal(response.status, 409); assert.equal((await response.json()).code, "EMAIL_EXISTS")
  assert.equal(app.records.length, 1); assert.equal(app.mail.length, 0); assert.equal(app.consents.length, 0)
})

for (const change of [{ confirmPassword: "different" }, { acceptTerms: false }, { acceptPrivacyNotice: false }]) {
  test(`registration rejects invalid agreement/password input: ${Object.keys(change)[0]}`, async () => {
    const app = harness(); const response = await app.loader.load("app/api/auth/signup/route.ts").POST(app.request(registration(change), "/api/auth/signup"))
    assert.equal(response.status, 400); assert.equal(app.records.length, 1)
  })
}

// Security expectations exercise the actual handlers and session verification.
test("registration rejects a malformed email before storing an account", async () => {
  const app = harness(); const response = await app.loader.load("app/api/auth/signup/route.ts").POST(
    app.request(registration({ email: "not-an-email" }), "/api/auth/signup"))
  assert.equal(response.status, 400, "Malformed registration emails must be rejected")
  assert.equal(app.records.length, 1)
})

test("logout expires both cookies and clears the ordinary browser session", async () => {
  const app = harness(); app.adopt(await app.login())
  const response = await app.loader.load("app/api/auth/logout/route.ts").POST()
  assert.equal(response.status, 200)
  for (const name of ["session", "user"]) {
    const cookie = response.cookies.get(name)
    assert.equal(cookie.value, ""); assert.equal(cookie.maxAge, 0)
    assert.equal(cookie.httpOnly, true); assert.equal(cookie.secure, true); assert.equal(cookie.sameSite, "lax")
  }
  app.state.token = response.cookies.get("session").value
  assert.equal(await app.session(), null)
})

for (const transport of ["cookie", "bearer"]) test(`logout invalidates a copied session token replayed through ${transport}`, async () => {
  const app = harness(); const copied = app.adopt(await app.login())
  assert.ok(await app.session(), "Replay test requires an initially valid session")
  await app.loader.load("app/api/auth/logout/route.ts").POST()
  app.state.token = transport === "cookie" ? copied : undefined
  app.state.bearer = transport === "bearer" ? copied : undefined
  assert.equal(await app.session(), null, `A copied pre-logout ${transport} token must not authenticate after logout`)
})

test("logout remains usable without a valid or unexpired session", async () => {
  const app = harness(); app.state.token = "expired-or-malformed"
  assert.equal((await app.loader.load("app/api/auth/logout/route.ts").POST()).status, 200)
  assert.equal(app.revokedSessions.size, 0)
})

test("logout revokes only its device and a fresh login receives a different token", async () => {
  const app = harness(); const first = app.adopt(await app.login())
  const second = app.adopt(await app.login())
  assert.notEqual(first, second)
  app.state.token = first
  assert.equal((await app.loader.load("app/api/auth/logout/route.ts").POST()).status, 200)
  app.state.token = second; assert.ok(await app.session())
  const fresh = app.adopt(await app.login())
  assert.notEqual(fresh, first); assert.ok(await app.session())
})

test("repeated logout is idempotent and stores only a digest until token expiry", async () => {
  const app = harness(); const token = app.adopt(await app.login())
  const payload = await app.loader.load("lib/session.ts").verifySessionToken(token)
  const logout = app.loader.load("app/api/auth/logout/route.ts").POST
  assert.equal((await logout()).status, 200); assert.equal((await logout()).status, 200)
  assert.equal(app.revokedSessions.size, 1)
  const entry = [...app.revokedSessions.values()][0]
  assert.equal(entry._id, crypto.createHash("sha256").update(token).digest("hex"))
  assert.equal(Number(entry.expiresAt), payload.exp * 1000)
  assert.equal(JSON.stringify(entry).includes(token), false)
})

test("logout reports revocation storage failure while still expiring browser cookies", async () => {
  const app = harness(); app.adopt(await app.login())
  app.state.revocationWriteFailure = new Error("Fixture revocation outage")
  const response = await app.loader.load("app/api/auth/logout/route.ts").POST()
  assert.equal(response.status, 503); assert.equal(response.headers.get("retry-after"), "60")
  for (const name of ["session", "user"]) assert.equal(response.cookies.get(name).maxAge, 0)
  assert.equal(app.revokedSessions.size, 0)
})

test("revocation lookup outage fails closed without pretending the user logged out", async () => {
  const app = harness(); app.adopt(await app.login())
  app.state.revocationReadFailure = new Error("Fixture revocation outage")
  await assert.rejects(() => app.session(), /Fixture revocation outage/)
  assert.equal((await app.loader.load("app/api/auth/session/route.ts").GET()).status, 503)
})

test("existing signed sessions without a session ID can also be revoked", async () => {
  const app = harness()
  const payload = Buffer.from(JSON.stringify({ id: accountId.toString(), email: account.email, role: "user",
    sessionVersion: 0, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")
  const signature = crypto.createHmac("sha256", app.loader.env.SESSION_SECRET).update(payload).digest("base64url")
  app.state.token = `${payload}.${signature}`
  assert.ok(await app.session())
  assert.equal((await app.loader.load("app/api/auth/logout/route.ts").POST()).status, 200)
  assert.equal(await app.session(), null)
})

test("native logout invalidates the presented access token and requests refresh revocation", async () => {
  const app = harness(); const token = app.adopt(await app.login())
  app.state.token = undefined; app.state.bearer = token
  const response = await app.loader.load("app/api/v1/auth/logout/route.ts").POST(
    app.request({ refreshToken: "synthetic-refresh-token" }, "/api/v1/auth/logout"))
  assert.equal(response.status, 200)
  assert.deepEqual(app.revoked[0], ["synthetic-refresh-token", "logout"])
  assert.equal(await app.session(), null)
})

test("native logout everywhere retires all previously issued access sessions", async () => {
  const app = harness(); const first = app.adopt(await app.login())
  const second = app.adopt(await app.login())
  const response = await app.loader.load("app/api/v1/auth/logout/route.ts").POST(
    app.request({ allDevices: true }, "/api/v1/auth/logout"))
  assert.equal(response.status, 200); assert.equal(app.records[0].sessionVersion, 1)
  assert.deepEqual(app.revoked[0], [accountId.toString(), "logout_all_devices"])
  for (const token of [first, second]) { app.state.token = token; assert.equal(await app.session(), null) }
  app.adopt(await app.login()); assert.ok(await app.session())
})

test("native logout everywhere requires authentication and ignores submitted user IDs", async () => {
  const app = harness()
  const response = await app.loader.load("app/api/v1/auth/logout/route.ts").POST(
    app.request({ allDevices: true, userId: accountId.toString() }, "/api/v1/auth/logout"))
  assert.equal(response.status, 401); assert.equal(app.records[0].sessionVersion, 0)
  assert.equal(app.updates.length, 0); assert.equal(app.revoked.length, 0)
})

test("logout everywhere stays invalidated if refresh-token cleanup is interrupted", async () => {
  const app = harness(); const copied = app.adopt(await app.login())
  app.state.refreshRevocationFailure = new Error("Fixture refresh storage outage")
  const response = await app.loader.load("app/api/v1/auth/logout/route.ts").POST(
    app.request({ allDevices: true }, "/api/v1/auth/logout"))
  assert.equal(response.status, 500)
  app.state.token = copied; assert.equal(await app.session(), null)
  assert.equal(app.records[0].sessionVersion, 1)
})

function mobileHarness({ expired = false, logoutStatus = 200 } = {}) {
  const calls = []
  let accessToken = "synthetic-mobile-access", refreshToken = "synthetic-mobile-refresh"
  const store = {
    getAccessToken: () => accessToken, getRefreshToken: async () => refreshToken,
    isAccessTokenExpired: () => expired,
    setAccessToken: value => { accessToken = value; expired = false },
    setRefreshToken: async value => { refreshToken = value }, setCachedUser: async () => {}, clearTokens: async () => {},
  }
  const fetch = async (url, init) => {
    calls.push({ url, init })
    if (url.endsWith("/api/v1/auth/refresh")) return Response.json({ accessToken: "refreshed-access",
      refreshToken: "refreshed-refresh", expiresIn: 3600, user: { id: accountId.toString() } })
    return Response.json({ success: true }, { status: url.endsWith("/api/v1/auth/logout") ? logoutStatus : 200 })
  }
  const client = sourceLoader({
    "expo-constants": { expoConfig: { extra: { apiBaseUrl: "https://shop.example.invalid" } } },
    "@/auth/token-store": store,
  }, { fetch }).load("mobile/src/api/client.ts")
  const service = sourceLoader({
    "@/api/client": client, "@/auth/token-store": store,
    "expo-device": {}, "react-native": { Platform: { OS: "android" } },
  }).load("mobile/src/api/auth.ts")
  return { calls, client, service }
}

for (const [label, expired, logoutStatus] of [["current access", false, 200], ["expired access", true, 200], ["rejected access", false, 401]]) {
  test(`mobile logout sends its existing token pair without refresh: ${label}`, async () => {
    const app = mobileHarness({ expired, logoutStatus }); await app.service.logout()
    assert.equal(app.calls.length, 1)
    assert.equal(app.calls[0].url, "https://shop.example.invalid/api/v1/auth/logout")
    assert.equal(app.calls[0].init.headers.authorization, "Bearer synthetic-mobile-access")
    assert.deepEqual(JSON.parse(app.calls[0].init.body), { refreshToken: "synthetic-mobile-refresh" })
  })
}

test("ordinary protected mobile requests still refresh expired access tokens", async () => {
  const app = mobileHarness({ expired: true })
  await app.client.api.get("/api/account/addresses", { auth: true })
  assert.equal(app.calls.length, 2)
  assert.equal(app.calls[0].url, "https://shop.example.invalid/api/v1/auth/refresh")
  assert.equal(app.calls[1].init.headers.authorization, "Bearer refreshed-access")
})

for (const [label, offset] of [["already expired", -10], ["expiry boundary", 0]]) test(`session denies ${label} signed tokens`, async () => {
  const app = harness(); app.state.token = await app.loader.load("lib/session.ts").createSessionToken({
    id: accountId.toString(), email: account.email, role: "user", sessionVersion: 0, exp: Math.floor(Date.now() / 1000) + offset,
  })
  assert.equal(await app.session(), null)
  assert.equal((await app.loader.load("app/api/account/addresses/route.ts").GET()).status, 401)
})

test("missing, malformed and tampered session tokens fail closed", async () => {
  const app = harness(); const valid = app.adopt(await app.login())
  for (const token of [undefined, "plain-cookie", "a.b", `${valid}tampered`]) {
    app.state.token = token; assert.equal(await app.session(), null)
  }
})

test("password reset hashes its capability, consumes it once and invalidates old sessions", async () => {
  const app = harness(); const oldToken = app.adopt(await app.login())
  const response = await app.loader.load("app/api/auth/forgot-password/route.ts").POST(app.request({ email: account.email }, "/api/auth/forgot-password"))
  assert.equal(response.status, 200); assert.equal(app.mail.length, 1)
  const rawToken = new URL(app.mail[0].html.match(/href="([^"]+)"/)[1]).searchParams.get("token")
  assert.ok(rawToken); assert.equal(app.records[0].resetPasswordToken, crypto.createHash("sha256").update(rawToken).digest("hex"))
  assert.notEqual(app.records[0].resetPasswordToken, rawToken)
  const nextPassword = `Bb2!${crypto.randomBytes(16).toString("hex")}`
  const reset = app.loader.load("app/api/auth/reset-password/route.ts").POST
  assert.equal((await reset(app.request({ token: rawToken, password: nextPassword }))).status, 200)
  assert.equal(app.records[0].sessionVersion, 1); assert.equal(app.records[0].resetPasswordToken, undefined)
  assert.equal(bcrypt.getRounds(app.records[0].password), 12)
  assert.deepEqual(app.revoked[0], [accountId.toString(), "password_reset"])
  app.state.token = oldToken; assert.equal(await app.session(), null)
  assert.equal((await reset(app.request({ token: rawToken, password: nextPassword }))).status, 400)
  assert.equal((await app.login()).status, 401)
  assert.equal((await app.login({ email: account.email, password: nextPassword })).status, 200)
})

for (const [label, expiry, presented] of [
  ["expired", -1000, "right-token"], ["incorrect", 60000, "wrong-token"],
]) test(`password reset rejects ${label} capability without changing credentials`, async () => {
  const app = harness({ record: { ...account, resetPasswordToken: crypto.createHash("sha256").update("right-token").digest("hex"), resetPasswordExpiry: new Date(Date.now() + expiry) } })
  const response = await app.loader.load("app/api/auth/reset-password/route.ts").POST(app.request({ token: presented, password }))
  assert.equal(response.status, 400); assert.equal(app.records[0].password, passwordHash); assert.equal(app.revoked.length, 0)
})

test("password recovery gives identical public responses for existing and missing emails", async () => {
  const responses = []
  for (const email of [account.email, "missing@example.invalid"]) {
    const app = harness(); const response = await app.loader.load("app/api/auth/forgot-password/route.ts").POST(app.request({ email }, "/api/auth/forgot-password"))
    responses.push({ status: response.status, body: await response.json() })
  }
  assert.deepEqual(responses[0], responses[1])
})

for (const [label, token, expiry, expected] of [
  ["valid", "verification-token", 60000, "success"], ["incorrect", "wrong", 60000, "invalid"],
  ["expired", "verification-token", -1000, "expired"], ["malformed expiry", "verification-token", "invalid-date", "expired"],
]) test(`email verification handles ${label} capability`, async () => {
  const app = harness({ record: { ...account, emailVerified: false, emailVerificationToken: "verification-token",
    emailVerificationExpiry: typeof expiry === "number" ? new Date(Date.now() + expiry) : expiry } })
  const route = app.loader.load("app/api/auth/verify-email/route.ts")
  const response = await route.GET(app.request(undefined, `/api/auth/verify-email?userId=${accountId}&token=${token}`, {}, "GET"))
  assert.equal(new URL(response.headers.get("location")).searchParams.get("status"), expected)
  assert.equal(app.records[0].emailVerified, expected === "success")
  if (expected === "success") {
    assert.equal(app.records[0].emailVerificationToken, undefined)
    const replay = await route.GET(app.request(undefined, `/api/auth/verify-email?userId=${accountId}&token=${token}`, {}, "GET"))
    assert.equal(new URL(replay.headers.get("location")).searchParams.get("status"), "already")
  }
})

test("verification-email resend requires authentication", async () => {
  const app = harness(); const response = await app.loader.load("app/api/auth/verify-email/route.ts").POST(app.request({}, "/api/auth/verify-email"))
  assert.equal(response.status, 401); assert.equal(app.mail.length, 0)
})

test("signup and resend deliver visible verification links matching the stored token", async () => {
  const app = harness({ record: { ...account, emailVerified: false }, env: { NEXT_PUBLIC_SITE_URL: "sarastores.com/" } })
  const signup = await app.loader.load("app/api/auth/signup/route.ts").POST(app.request(registration(), "/api/auth/signup"))
  assert.equal(signup.status, 200)
  app.adopt(await app.login())
  const resend = await app.loader.load("app/api/auth/verify-email/route.ts").POST(app.request({}, "/api/auth/verify-email"))
  assert.equal(resend.status, 200)
  assert.equal(app.mail.length, 2)
  for (const message of app.mail) {
    const url = new URL(message.html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&"))
    assert.equal(url.origin, "https://sarastores.com")
    assert.equal(url.pathname, "/api/auth/verify-email")
    const user = app.records.find(record => record._id.toString() === url.searchParams.get("userId"))
    assert.equal(url.searchParams.get("token"), user.emailVerificationToken)
    assert.ok(message.text.includes(url.toString()))
    assert.ok(message.html.includes(`>${url.toString().replaceAll("&", "&amp;")}<`))
  }
})

for (const [file, method] of [["app/api/account/addresses/route.ts", "GET"], ["app/api/admin/dashboard/route.ts", "GET"], ["app/api/users/[id]/route.ts", "GET"]]) {
  test(`direct anonymous API access is denied: ${file}`, async () => {
    const app = harness(); const response = await app.loader.load(file)[method](app.request(undefined, "/api/test", {}, "GET"), { params: Promise.resolve({ id: accountId.toString() }) })
    assert.equal(response.status, 401); assert.equal(app.queries.length, 0)
  })
}

for (const [role, staff, pages, path, expected] of [
  ["user", false, [], "/api/admin/dashboard", false], ["vendor", false, [], "/api/admin/dashboard", false],
  ["admin", false, [], "/api/admin/dashboard", true], ["superadmin", false, [], "/api/admin/dashboard", true],
  ["user", true, ["/admin/orders"], "/api/orders", true], ["user", true, ["/admin/orders"], "/api/admin/partners", false],
]) test(`live role/permission guard: ${role}, ${path}, access=${expected}`, async () => {
  const app = harness({ record: { ...account, role, dashboardAccess: staff, allowedPages: pages } })
  app.state.path = path; app.adopt(await app.login())
  assert.equal((await app.loader.load("lib/auth.ts").requireAdmin()).ok, expected)
})

test("changing or disabling a live account immediately removes its signed privileges", async () => {
  const app = harness({ record: { ...account, role: "admin" } }); app.adopt(await app.login())
  app.records[0].role = "user"; assert.equal((await app.loader.load("lib/auth.ts").requireAdmin()).ok, false)
  app.records[0].status = "inactive"; assert.equal(await app.session(), null)
})

test("login ignores attacker-supplied session identity and privilege fields", async () => {
  const app = harness()
  const planted = await app.loader.load("lib/session.ts").createSessionToken({ id: new ObjectId().toString(), email: "attacker@example.invalid", role: "superadmin" })
  const response = await app.login({ email: account.email, password, role: "superadmin", dashboardAccess: true, allowedPages: ["/admin"] }, { cookie: `session=${planted}` })
  const issued = app.adopt(response); assert.notEqual(issued, planted)
  const session = await app.session(); assert.equal(session.user.id, accountId.toString()); assert.equal(session.user.role, "user")
  assert.equal(session.user.dashboardAccess, false)
})

test("production login cookies have secure settings and credentials do not leak in JSON or logs", async () => {
  const app = harness({ env: { COOKIE_DOMAIN: ".example.invalid" } }); const response = await app.login()
  for (const name of ["session", "user"]) {
    const cookie = response.cookies.get(name)
    assert.equal(cookie.httpOnly, true); assert.equal(cookie.secure, true); assert.equal(cookie.sameSite, "lax")
    assert.equal(cookie.path, "/"); assert.equal(cookie.maxAge, 86400); assert.equal(cookie.domain, "example.invalid")
  }
  const token = response.cookies.get("session").value
  const exposed = JSON.stringify(await response.json()) + app.output.messages.join("\n")
  for (const secret of [password, passwordHash, token, app.loader.env.SESSION_SECRET]) assert.equal(exposed.includes(secret), false)
})

test("sixth failed login is throttled even when CAPTCHA is disabled and forwarding prefixes rotate", async () => {
  const app = harness()
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await app.login({ email: account.email, password: "Wrong-password-1!" },
      { "x-forwarded-for": `192.0.2.${attempt}, 198.51.100.23`, "x-real-ip": `192.0.2.${attempt}` })
    assert.equal(response.status, attempt < 5 ? 401 : 429)
  }
  assert.equal(app.queries.length, 5)
  assert.equal(new Set(app.rateHits.map(hit => hit.key)).size, 1)
  assert.ok(app.rateHits.every(hit => hit.max === 5 && hit.windowMs === 60000))
})

test("successful login resets only its own attempt bucket", async () => {
  const app = harness(); await app.login({ email: account.email, password: "wrong" })
  assert.equal(app.counts.size, 1); assert.equal((await app.login()).status, 200); assert.equal(app.counts.size, 0)
})

test("login fails closed when the shared brute-force protection store is unavailable", async () => {
  const app = harness(); app.state.limitFailure = new (app.loader.load("lib/api-error.ts").RateLimitUnavailableError)()
  const response = await app.login(); assert.equal(response.status, 503); assert.equal(app.queries.length, 0)
  assert.equal(response.cookies.get("session"), undefined)
})

test("enabled CAPTCHA rejects missing tokens before credential verification", async () => {
  const app = harness({ env: { RECAPTCHA_ENABLED: "true", NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "fixture-public", RECAPTCHA_SECRET_KEY: "fixture-secret" } })
  assert.equal((await app.login()).status, 429); assert.equal(app.queries.length, 0)
})

for (const name of ["account", "dashboard", "admin", "vendor"]) test(`anonymous direct page navigation is rejected by the ${name} server layout`, async () => {
  const jsx = (type, props) => ({ type, props })
  const loader = sourceLoader({
    "@/lib/auth": { getSession: async () => null },
    "next/navigation": { redirect: location => { throw Object.assign(new Error("Redirect"), { location }) } },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "@/lib/seo-page": { pageMetadata: () => () => ({}) },
    "@/components/Header": "header", "@/components/Footer": "footer",
    "./account-client-shell": "account", "./admin-client-shell": "admin", "./vendor-client-shell": "vendor",
    "@/components/account/AccountSidebar": "sidebar", "@/components/account/AccountBreadcrumb": "breadcrumb",
    "@/components/account/TrustStrip": "trust", "./layout.module.css": {},
  })
  await assert.rejects(() => loader.load(`app/${name}/layout.tsx`).default({ children: "private" }), error => error.location === `/login?redirect=/${name}`)
})

test("checkout page is deliberately accessible to guests and contains no server login gate", () => {
  const loader = sourceLoader({ "@/lib/seo-page": { pageMetadata: () => () => ({}) },
    "react/jsx-runtime": { jsx: (_type, props) => props } })
  const result = loader.load("app/checkout/layout.tsx").default({ children: "guest checkout" })
  assert.equal(result.children, "guest checkout")
})
