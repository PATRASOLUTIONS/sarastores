#!/usr/bin/env node
/**
 * Validates the endpoints the NEW mobile screens call, and the shapes they
 * destructure. tsc only asserts declared types; it never sees a real response.
 *
 *   node scripts/test-mobile-screens.mjs http://localhost:3005
 */

const BASE = process.argv[2] ?? "http://localhost:3005"
const EMAIL = process.env.MOBILE_TEST_EMAIL
const PASSWORD = process.env.MOBILE_TEST_PASSWORD

let passed = 0
let failed = 0

function check(name, ok, detail = "") {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}${detail ? `   ${detail}` : ""}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? `   ${detail}` : ""}`)
  }
}

async function json(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "content-type": "application/json", accept: "application/json", ...(options.headers ?? {}) },
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: res.status, body }
}

console.log(`\nmobile screen endpoint check against ${BASE}\n`)

// --- /brands ---------------------------------------------------------------
{
  const { status, body } = await json("/api/brands")
  const list = Array.isArray(body) ? body : body?.brands
  check("brands: reachable", status === 200, `status=${status}`)
  check("brands: array under .brands or bare", Array.isArray(list), `type=${Array.isArray(list) ? `array[${list.length}]` : typeof list}`)
  if (Array.isArray(list) && list.length) {
    check("brands[0].name is a string", typeof list[0].name === "string", `name=${list[0].name}`)
    const withSlug = list.find((b) => typeof b.slug === "string" && b.slug)
    check("at least one brand has a slug (detail route needs it)", Boolean(withSlug), withSlug ? `slug=${withSlug.slug}` : "none")

    if (withSlug) {
      const detail = await json(`/api/brands?slug=${encodeURIComponent(withSlug.slug)}`)
      check("brand detail: returns { brand }", Boolean(detail.body?.brand), `status=${detail.status}`)
    }
  }
}

// --- /offers ---------------------------------------------------------------
for (const section of ["todays-deals", "mega-sale"]) {
  const { status, body } = await json(`/api/offers?section=${section}&live=true`)
  const list = Array.isArray(body) ? body : body?.offers
  check(`offers?section=${section}: 200 + array`, status === 200 && Array.isArray(list), `status=${status} n=${Array.isArray(list) ? list.length : "n/a"}`)
}

// --- /stores ---------------------------------------------------------------
{
  const { status, body } = await json("/api/stores")
  const list = Array.isArray(body) ? body : (body?.stores ?? body?.data)
  check("stores: 200 + array", status === 200 && Array.isArray(list), `status=${status} n=${Array.isArray(list) ? list.length : "n/a"}`)
  if (Array.isArray(list) && list.length) {
    const s = list[0]
    check("store has name", typeof s.name === "string", `name=${s.name}`)
    check("store locator can build a map link", Boolean(s.mapUrl || (s.latitude && s.longitude) || s.address), "")
    const withCity = list.filter((x) => x.city).length
    check("stores expose city (locator filters on it)", withCity > 0, `${withCity}/${list.length} have city`)
  }
}

// --- /orders/track (public) ------------------------------------------------
{
  const { status, body } = await json("/api/orders/track?orderId=definitely-not-a-real-order")
  check("track: unknown id returns a handled error, not a crash", status === 404 || status === 400, `status=${status}`)
  check("track: error body has .error for the UI", typeof body?.error === "string", `error=${String(body?.error).slice(0, 60)}`)
}

// --- /products/bulk (compare) ---------------------------------------------
{
  const list = await json("/api/products?fields=card&limit=3")
  const ids = (Array.isArray(list.body) ? list.body : []).map((p) => p.id).filter(Boolean)
  if (ids.length) {
    const { status, body } = await json("/api/products/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, compare: true }),
    })
    const products = Array.isArray(body) ? body : body?.products
    check("products/bulk: 200 + array (compare screen)", status === 200 && Array.isArray(products), `status=${status} n=${Array.isArray(products) ? products.length : "n/a"}`)
  } else {
    check("products/bulk: had ids to test with", false, "no products returned")
  }
}

// --- forgot-password -------------------------------------------------------
{
  const { status, body } = await json("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "definitely-not-a-user@example.invalid" }),
  })
  // Must not leak whether the account exists.
  check("forgot-password: accepts unknown email without leaking", status === 200, `status=${status}`)
  check("forgot-password: does not reveal account existence", !/not found|no account|doesn't exist/i.test(JSON.stringify(body)), "")
}

// --- reset-password rejects a bad token ------------------------------------
{
  const { status, body } = await json("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: "bogus-token", password: "Abcdef123" }),
  })
  check("reset-password: rejects an invalid token", status === 400, `status=${status}`)
  check("reset-password: error is a string the screen can show", typeof body?.error === "string", `error=${String(body?.error).slice(0, 50)}`)
}

// --- contact-inquiries validation -----------------------------------------
{
  const { status, body } = await json("/api/contact-inquiries", {
    method: "POST",
    body: JSON.stringify({ name: "Test", email: "not-an-email", phone: "123" }),
  })
  check("contact: rejects a bad email", status === 400, `status=${status}`)
  check("contact: error under .error", typeof body?.error === "string", `error=${String(body?.error).slice(0, 50)}`)
}

// --- authenticated screens -------------------------------------------------
if (EMAIL && PASSWORD) {
  const login = await json("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = login.body?.accessToken
  check("login for authed screen checks", Boolean(token), `status=${login.status}`)

  if (token) {
    const auth = { authorization: `Bearer ${token}` }

    const prefs = await json("/api/account/preferences", { headers: auth })
    check("preferences: 200 with bearer", prefs.status === 200, `status=${prefs.status}`)
    check("preferences: { profile } present", Boolean(prefs.body?.profile), "")
    check(
      "preferences: profile.consent has email/whatsapp/sms",
      prefs.body?.profile?.consent && ["email", "whatsapp", "sms"].every((k) => k in prefs.body.profile.consent),
      `consent=${JSON.stringify(prefs.body?.profile?.consent)}`,
    )

    const session = await json("/api/auth/session", { headers: auth })
    const userId = session.body?.user?.id
    check("session returns a user id for the profile screen", typeof userId === "string", `id=${userId}`)

    if (userId) {
      const user = await json(`/api/users/${userId}`, { headers: auth })
      check("users/[id]: 200 for own record (profile screen)", user.status === 200, `status=${user.status}`)
      check("users/[id]: password is never returned", !("password" in (user.body ?? {})), "")
    }

    const orders = await json("/api/orders", { headers: auth })
    const first = Array.isArray(orders.body) ? orders.body[0] : null
    if (first) {
      const detail = await json(`/api/orders/${encodeURIComponent(first.id ?? first.orderId)}`, { headers: auth })
      check("order detail: 200 for own order", detail.status === 200, `status=${detail.status}`)
      check("order detail: has status + total", typeof detail.body?.status === "string" && typeof detail.body?.total === "number", `status=${detail.body?.status}`)

      const track = await json(`/api/orders/track?orderId=${encodeURIComponent(first.orderId ?? first.id)}`)
      check("track: finds a real order", track.status === 200 && Boolean(track.body?.tracking), `status=${track.status}`)
      if (track.body?.tracking) {
        const t = track.body.tracking
        const STEPS = ["ordered", "processing", "shipped", "transit", "out_for_delivery", "delivered"]
        check("track: currentStatus is one of the 6 UI steps", STEPS.includes(t.currentStatus), `currentStatus=${t.currentStatus}`)
        check("track: events is an array", Array.isArray(t.events), `n=${t.events?.length}`)
      }
    } else {
      console.log("  SKIP  order detail/track (no orders on this account)")
    }
  }
} else {
  console.log("  SKIP  authenticated screens (set MOBILE_TEST_EMAIL / MOBILE_TEST_PASSWORD)")
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
