import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server.js"
import { sourceLoader } from "./source-loader.mjs"
import { checkDeploymentEnvironment } from "../scripts/check-deployment-env.mjs"

const enabledEnv = { RECAPTCHA_ENABLED: "true", NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "fixture-site", RECAPTCHA_SECRET_KEY: "fixture-secret" }
const request = () => new NextRequest("https://fixture.invalid/api/auth/login", { headers: { "user-agent": "Fixture Browser" } })
function botHarness(env, fetch) {
  return sourceLoader({
    "@/lib/rate-limit-store": { rateLimitHit: async () => ({ limited: false }) },
  }, { env, fetch }).load("lib/botDetection.ts")
}

test("CAPTCHA config exposes only a public key and honors explicit false with configured keys", async () => {
  for (const flag of ["true", "false"]) {
    const loader = sourceLoader({}, { env: { ...enabledEnv, RECAPTCHA_ENABLED: flag } })
    const response = await loader.load("app/api/auth/config/route.ts").GET()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    const body = await response.json()
    assert.deepEqual(body.recaptcha, { enabled: flag === "true", siteKey: flag === "true" ? "fixture-site" : null })
    assert.ok(!JSON.stringify(body).includes("fixture-secret"))
  }
})

test("invalid flags and incomplete enabled configurations fail closed with 503", async () => {
  for (const env of [
    { ...enabledEnv, RECAPTCHA_ENABLED: "yes" },
    { RECAPTCHA_ENABLED: "true" },
    { RECAPTCHA_ENABLED: "true", RECAPTCHA_SECRET_KEY: "fixture" },
    { RECAPTCHA_ENABLED: "true", NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "fixture" },
  ]) {
    const loader = sourceLoader({}, { env })
    assert.equal((await loader.load("app/api/auth/config/route.ts").GET()).status, 503)
    await assert.rejects(botHarness(env).detectBot(request(), {}, { requireRecaptcha: true }), /Security validation/)
  }
})

test("disabled CAPTCHA skips Google but retains other bot checks", async () => {
  const bot = botHarness({ ...enabledEnv, RECAPTCHA_ENABLED: "false" })
  assert.equal((await bot.detectBot(request(), {}, { requireRecaptcha: true })).isBot, false)
  assert.equal((await bot.detectBot(request(), { recaptchaToken: {} }, { requireRecaptcha: true })).isBot, false)
  assert.equal((await bot.detectBot(request(), { website: "spam" }, { requireRecaptcha: true })).isBot, true)
  assert.equal((await bot.detectBot(request(), { formTimestamp: Date.now() }, { requireRecaptcha: true })).isBot, true)
})

test("enabled website CAPTCHA requires tokens and verifies once with encoded values and minimum score", async () => {
  let calls = 0
  let score = 0.9
  const bot = botHarness(enabledEnv, async (_url, options) => {
    calls++
    assert.equal(new URLSearchParams(options.body).get("response"), "token&value")
    return Response.json({ success: true, score })
  })
  for (const token of [undefined, "", " ", {}]) {
    assert.equal((await bot.detectBot(request(), { recaptchaToken: token }, { requireRecaptcha: true })).isBot, true)
  }
  assert.equal(calls, 0)
  assert.equal((await bot.detectBot(request(), { recaptchaToken: "token&value" }, { requireRecaptcha: true })).isBot, false)
  assert.equal(calls, 1)
  score = 0.1
  assert.equal((await bot.detectBot(request(), { recaptchaToken: "token&value" }, { requireRecaptcha: true })).isBot, true)
  assert.equal((await bot.detectBot(request(), {})).isBot, false, "Native token-optional contract remains unchanged")
})

test("production preflight permits explicit false without keys and rejects invalid flags", () => {
  const captchaErrors = env => checkDeploymentEnvironment(env).filter(error => error.includes("RECAPTCHA"))
  assert.deepEqual(captchaErrors({ RECAPTCHA_ENABLED: "false" }), [])
  assert.equal(captchaErrors({ RECAPTCHA_ENABLED: "true" }).length, 2)
  assert.ok(captchaErrors({ RECAPTCHA_ENABLED: "invalid" }).some(error => error.includes("true or false")))
})

test("website routes enforce enabled CAPTCHA before credentials or database access", async () => {
  for (const filename of ["app/api/auth/login/route.ts", "app/api/auth/signup/route.ts"]) {
    const loader = sourceLoader({
      "@/lib/rate-limit-store": { rateLimitHit: async () => ({ limited: false }) },
    }, { env: enabledEnv })
    const routeRequest = new NextRequest("https://fixture.invalid/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json", "user-agent": "Fixture Browser" },
      body: JSON.stringify({ email: "fixture@example.invalid", password: "Fixture-password-123" }),
    })
    assert.equal((await loader.load(filename).POST(routeRequest)).status, 429)
  }
})

test("disabled website login reaches credentials and issues an httpOnly session", async () => {
  let verified = 0
  const loader = sourceLoader({
    "@/lib/rate-limit-store": { rateLimitHit: async () => ({ limited: false }) },
    "@/lib/auth-credentials": {
      verifyCredentials: async () => { verified++; return { ok: true, user: { id: "fixture-user", email: "fixture@example.invalid", role: "user" } } },
      buildSessionPayload: user => user,
    },
  }, { env: { ...enabledEnv, RECAPTCHA_ENABLED: "false" } })
  const response = await loader.load("app/api/auth/login/route.ts").POST(new NextRequest("https://fixture.invalid/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json", "user-agent": "Fixture Browser" },
    body: JSON.stringify({ email: "fixture@example.invalid", password: "Fixture-password-123" }),
  }))
  assert.equal(response.status, 200)
  assert.equal(verified, 1)
  assert.match(response.headers.get("set-cookie"), /session=.*HttpOnly/i)
})

test("signup verifies its single-use token once before ordinary input validation", async () => {
  let calls = 0
  const loader = sourceLoader({
    "@/lib/rate-limit-store": { rateLimitHit: async () => ({ limited: false }) },
  }, { env: enabledEnv, fetch: async () => { calls++; return Response.json({ success: calls === 1, score: 0.9 }) } })
  const response = await loader.load("app/api/auth/signup/route.ts").POST(new NextRequest("https://fixture.invalid/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json", "user-agent": "Fixture Browser" },
    body: JSON.stringify({ recaptchaToken: "single-use-fixture" }),
  }))
  assert.equal(response.status, 400)
  assert.equal(calls, 1)
  assert.doesNotMatch(JSON.stringify(await response.json()), /reCAPTCHA/)
})

function hookHarness(config, { strict = false, execute = async () => "fixture-token" } = {}) {
  let index = 0
  const states = []
  const effects = []
  const scripts = []
  let cleanup
  const window = { grecaptcha: { ready: callback => callback(), execute } }
  const hook = sourceLoader({
    react: {
      useState: initial => {
        const slot = index++
        if (!(slot in states)) states[slot] = initial
        return [states[slot], value => { states[slot] = value }]
      },
      useCallback: callback => callback,
      useEffect: effect => { if (!cleanup) effects.push(effect) },
    },
  }, {
    fetch: async () => config instanceof Error ? Promise.reject(config) : Response.json({ recaptcha: config }),
    context: { window, document: { createElement: () => ({}), body: { appendChild: script => { scripts.push(script); queueMicrotask(() => script.onload()) } } } },
  }).load("hooks/useRecaptcha.ts")
  const render = () => { index = 0; return hook.useRecaptcha("login") }
  render()
  cleanup = effects[0]()
  if (strict) { cleanup(); cleanup = effects[0]() }
  return { render, scripts, cleanup }
}
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate) }

test("disabled hook becomes ready without loading or executing Google", async () => {
  const app = hookHarness({ enabled: false, siteKey: null })
  assert.equal(app.render().isReady, false)
  await flush()
  assert.equal(app.render().enabled, false)
  assert.equal(app.render().isReady, true)
  assert.equal(await app.render().getToken(), null)
  assert.equal(app.scripts.length, 0)
})

test("StrictMode mounts load one script and token errors are thrown immediately", async () => {
  const app = hookHarness({ enabled: true, siteKey: "fixture" }, { strict: true, execute: async () => { throw new Error("provider-specific failure") } })
  await flush()
  assert.equal(app.scripts.length, 1)
  assert.equal(app.render().isReady, true)
  await assert.rejects(app.render().getToken(), /Security validation failed/)
  assert.match(app.render().error, /Security validation failed/)
})

test("config failures keep hook fail closed with a visible error", async () => {
  const app = hookHarness(new Error("Configuration request failed"))
  await flush()
  assert.equal(app.render().enabled, true)
  assert.equal(app.render().isReady, false)
  assert.match(app.render().error, /Configuration request failed/)
  assert.equal(app.scripts.length, 0)
})
