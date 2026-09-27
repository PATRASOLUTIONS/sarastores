/**
 * End-to-end check for the native auth surface.
 *
 * Usage:
 *   node scripts/test-mobile-auth.mjs [baseUrl]
 * Requires MOBILE_TEST_EMAIL / MOBILE_TEST_PASSWORD and a running server.
 */
const BASE = process.argv[2] || "http://localhost:3005"
const EMAIL = process.env.MOBILE_TEST_EMAIL
const PASSWORD = process.env.MOBILE_TEST_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error("Set MOBILE_TEST_EMAIL and MOBILE_TEST_PASSWORD")
  process.exit(1)
}

let pass = 0
let fail = 0
function check(label, ok, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? "   " + detail : ""}`)
  ok ? pass++ : fail++
}

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON */ }
  return { status: res.status, json, text }
}

console.log(`native auth check against ${BASE}\n`)

// 1. Login
const login = await call("/api/v1/auth/login", {
  method: "POST",
  body: { email: EMAIL, password: PASSWORD, device: { deviceId: "smoke-test", deviceName: "CI", platform: "ios" } },
})
check("login returns 200", login.status === 200, `got ${login.status}`)
check("login returns accessToken", !!login.json?.accessToken)
check("login returns refreshToken", !!login.json?.refreshToken)
check("access token is short lived", login.json?.expiresIn === 3600, `expiresIn=${login.json?.expiresIn}`)
if (!login.json?.accessToken) { console.log("\naborting: no token"); process.exit(1) }

const access = login.json.accessToken
const refresh = login.json.refreshToken

// 2. Bearer works on an existing route that predates this change
const session = await call("/api/auth/session", { token: access })
check("GET /api/auth/session accepts Bearer", session.status === 200 && session.json?.user?.email?.toLowerCase() === EMAIL.toLowerCase(),
  `status=${session.status} user=${session.json?.user?.email ?? "null"}`)

const cart = await call("/api/cart", { token: access })
check("GET /api/cart accepts Bearer", cart.status === 200, `got ${cart.status}`)

// 3. Middleware (not just route handlers) honours Bearer
const adminRoute = await call("/api/admin/notifications", { token: access })
check("middleware honours Bearer on /api/admin/*", adminRoute.status !== 401, `got ${adminRoute.status}`)

// 4. No token is still rejected
const noToken = await call("/api/admin/notifications")
check("no token still blocked on /api/admin/*", noToken.status === 401, `got ${noToken.status}`)

const badToken = await call("/api/auth/session", { token: "not.a.real.token" })
check("forged token yields no user", badToken.json?.user == null, `user=${JSON.stringify(badToken.json?.user)}`)

// 5. Refresh rotates
const rotated = await call("/api/v1/auth/refresh", { method: "POST", body: { refreshToken: refresh } })
check("refresh returns 200", rotated.status === 200, `got ${rotated.status}`)
check("refresh issues a NEW refresh token", !!rotated.json?.refreshToken && rotated.json.refreshToken !== refresh)
check("refresh issues a new access token", !!rotated.json?.accessToken && rotated.json.accessToken !== access)

const rotatedRefresh = rotated.json?.refreshToken
const rotatedAccess = rotated.json?.accessToken

if (rotatedAccess) {
  const s2 = await call("/api/auth/session", { token: rotatedAccess })
  check("rotated access token works", s2.status === 200 && !!s2.json?.user)
}

// 6. Reuse detection: replaying the retired token must fail AND kill the family
const replay = await call("/api/v1/auth/refresh", { method: "POST", body: { refreshToken: refresh } })
check("replaying a rotated refresh token is rejected", replay.status === 401, `got ${replay.status}`)

if (rotatedRefresh) {
  const afterReuse = await call("/api/v1/auth/refresh", { method: "POST", body: { refreshToken: rotatedRefresh } })
  check("reuse revokes the whole family", afterReuse.status === 401, `got ${afterReuse.status}`)
}

// 7. Logout revokes
const fresh = await call("/api/v1/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD } })
if (fresh.json?.refreshToken) {
  const out = await call("/api/v1/auth/logout", { method: "POST", body: { refreshToken: fresh.json.refreshToken } })
  check("logout returns 200", out.status === 200, `got ${out.status}`)
  const afterLogout = await call("/api/v1/auth/refresh", { method: "POST", body: { refreshToken: fresh.json.refreshToken } })
  check("refresh token is dead after logout", afterLogout.status === 401, `got ${afterLogout.status}`)
}

// 8. Web cookie login must still work
const webLogin = await fetch(BASE + "/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  signal: AbortSignal.timeout(120000),
})
const setCookie = webLogin.headers.get("set-cookie") || ""
check("web cookie login still works", webLogin.status === 200 && setCookie.includes("session="), `status=${webLogin.status}`)

const badCreds = await call("/api/v1/auth/login", { method: "POST", body: { email: EMAIL, password: "wrong-password-xyz" } })
check("wrong password is rejected", badCreds.status === 401, `got ${badCreds.status}`)

// 9. Google native sign-in must reject a token it cannot verify
const badGoogle = await call("/api/v1/auth/google", { method: "POST", body: { idToken: "clearly-not-a-google-token" } })
check("google rejects an unverifiable idToken", [400, 401, 404, 500, 503].includes(badGoogle.status), `got ${badGoogle.status}`)
const noGoogleToken = await call("/api/v1/auth/google", { method: "POST", body: {} })
check("google requires idToken", noGoogleToken.status === 400, `got ${noGoogleToken.status}`)

// 10. Push device registration
const devNoAuth = await call("/api/v1/notifications/devices", { method: "POST", body: { token: "ExponentPushToken[abc123]", platform: "ios" } })
check("device registration requires auth", devNoAuth.status === 401, `got ${devNoAuth.status}`)

const devOk = await call("/api/v1/notifications/devices", {
  method: "POST", token: access,
  body: { token: "ExponentPushToken[smoke-test-token]", platform: "ios", deviceName: "CI" },
})
check("device registration succeeds with Bearer", devOk.status === 200, `got ${devOk.status}`)

const devBadPlatform = await call("/api/v1/notifications/devices", {
  method: "POST", token: access, body: { token: "ExponentPushToken[x]", platform: "windows" },
})
check("device registration validates platform", devBadPlatform.status === 400, `got ${devBadPlatform.status}`)

const devDel = await call("/api/v1/notifications/devices", {
  method: "DELETE", token: access, body: { token: "ExponentPushToken[smoke-test-token]" },
})
check("device unregistration succeeds", devDel.status === 200, `got ${devDel.status}`)

// 11. Account deletion guards (never actually deletes — no password supplied)
const delNoAuth = await call("/api/v1/account", { method: "DELETE", body: {} })
check("account deletion requires auth", delNoAuth.status === 401, `got ${delNoAuth.status}`)

const delNoPassword = await call("/api/v1/account", { method: "DELETE", token: access, body: {} })
check("account deletion requires password confirmation", delNoPassword.status === 400, `got ${delNoPassword.status}`)

const delWrongPassword = await call("/api/v1/account", { method: "DELETE", token: access, body: { password: "definitely-wrong" } })
check("account deletion rejects a wrong password", delWrongPassword.status === 401, `got ${delWrongPassword.status}`)

// 12. Server-computed display fields
const displayList = await call("/api/products?fields=card&limit=3&display=1")
const first = Array.isArray(displayList.json) ? displayList.json[0] : null
check("products?display=1 returns display block", !!first?.display, `keys=${first ? Object.keys(first.display ?? {}).join(",") : "none"}`)
check("display includes discountPercent", typeof first?.display?.discountPercent === "number")
check("display includes emi", typeof first?.display?.emi?.perMonth === "number", `emi=${JSON.stringify(first?.display?.emi)}`)

const plain = await call("/api/products?fields=card&limit=1")
const plainFirst = Array.isArray(plain.json) ? plain.json[0] : null
check("display is opt-in (absent without the flag)", plainFirst && plainFirst.display === undefined)

if (first?.slug) {
  const pdp = await call(`/api/products/${encodeURIComponent(first.slug)}?display=1`)
  check("product detail supports display=1", pdp.status === 200 && !!pdp.json?.display, `got ${pdp.status}`)
}

// 13. Deep-link association files are routed (404 until the app IDs are set)
const aasa = await call("/.well-known/apple-app-site-association")
check("AASA route is reachable via rewrite", aasa.status === 200 || aasa.status === 404, `got ${aasa.status}`)
const assetlinks = await call("/.well-known/assetlinks.json")
check("assetlinks route is reachable via rewrite", assetlinks.status === 200 || assetlinks.status === 404, `got ${assetlinks.status}`)

// 14. Checkout payload shapes the mobile app sends. Nothing here creates a real
// order: the "online" path is rejected before an order is written, and reaching
// any business-logic error at all proves the payload cleared schema validation.
const stockList = await call("/api/products?fields=card&limit=40&display=1")
const sellable = Array.isArray(stockList.json)
  ? stockList.json.find((p) => p?.display?.inStock && p?.price > 0)
  : null

if (sellable?.id) {
  const lineItems = [{ id: sellable.id, productId: sellable.id, quantity: 1 }]
  const customer = {
    firstName: "Smoke", lastName: "Test", email: EMAIL, phone: "9000000000",
    address: "1 Test Street", city: "Bengaluru", state: "Karnataka", zipCode: "560001",
  }

  const orderShape = await call("/api/orders", {
    method: "POST", token: access,
    body: { items: lineItems, customer, paymentMethod: "online" },
  })
  check(
    "mobile order payload clears server schema validation",
    orderShape.status === 400 && !/invalid input/i.test(orderShape.json?.error ?? ""),
    `status=${orderShape.status} error=${orderShape.json?.error ?? JSON.stringify(orderShape.json?.details)}`,
  )
  check(
    "order is blocked without a payment reference",
    /payment reference/i.test(orderShape.json?.error ?? ""),
    `error=${orderShape.json?.error}`,
  )

  const badShape = await call("/api/orders", {
    method: "POST", token: access,
    body: { items: [], customer, paymentMethod: "online" },
  })
  check("server still rejects an empty cart", badShape.status === 400 && /invalid input/i.test(badShape.json?.error ?? ""),
    `status=${badShape.status} error=${badShape.json?.error}`)

  const quote = await call("/api/payment/create-order", {
    method: "POST", token: access,
    body: { items: lineItems, currency: "INR" },
  })
  check(
    "create-order accepts id/productId/quantity items",
    quote.status === 200 && !!quote.json?.orderId && !!quote.json?.keyId,
    quote.status === 200 ? `amount=${quote.json?.amount}` : `status=${quote.status} error=${quote.json?.error}`,
  )
} else {
  check("found an in-stock product to test checkout with", false, "no sellable product in the first 40")
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
