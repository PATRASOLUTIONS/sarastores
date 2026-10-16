import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

const launch = "2026-10-16T15:30:00+05:30"
const before = Date.parse("2026-10-16T15:29:59+05:30")
const at = Date.parse(launch)

test("handshake stays off until the env launch time, then goes live", () => {
  const { readHandshakeLaunch, handshakeIsLive } = sourceLoader().load("lib/handshake.ts")
  assert.equal(readHandshakeLaunch({}), null)
  assert.equal(readHandshakeLaunch({ HANDSHAKE_LAUNCH_AT: "tomorrow afternoon" }), null)

  const scheduled = readHandshakeLaunch({
    HANDSHAKE_LAUNCH_AT: launch,
    HANDSHAKE_PARTNER_URL: "http://bytewiseconsulting.in",
    HANDSHAKE_STORE_URL: "javascript:alert(1)",
  })
  assert.equal(scheduled.launchAt, new Date(at).toISOString())
  assert.equal(scheduled.partnerUrl, "https://bytewiseconsulting.in")
  assert.equal(scheduled.storeUrl, "https://sarastores.com")
  assert.equal(handshakeIsLive(scheduled.launchAt, before), false)
  assert.equal(handshakeIsLive(scheduled.launchAt, at), true)
})

test("homepage countdown reaches zero when ecommerce launches", () => {
  const { countdownParts } = sourceLoader().load("lib/handshake.ts")
  const soon = countdownParts(launch, at - 90_000)
  assert.deepEqual(
    { live: soon.live, days: soon.days, hours: soon.hours, minutes: soon.minutes, seconds: soon.seconds },
    { live: false, days: 0, hours: 0, minutes: 1, seconds: 30 },
  )
  const opened = countdownParts(launch, at)
  assert.equal(opened.live, true)
  assert.equal(opened.hours + opened.minutes + opened.seconds + opened.days, 0)
  const tomorrow = countdownParts(launch, at - (26 * 60 * 60 * 1000))
  assert.equal(tomorrow.days, 1)
  assert.equal(tomorrow.hours, 2)
})

test("handshake accepts the partner and store urls from the environment", () => {
  const { readHandshakeLaunch } = sourceLoader().load("lib/handshake.ts")
  const scheduled = readHandshakeLaunch({
    HANDSHAKE_LAUNCH_AT: launch,
    HANDSHAKE_PARTNER_URL: "https://bytewiseconsulting.in/about",
    HANDSHAKE_STORE_URL: "https://sarastores.com/",
  })
  assert.equal(scheduled.partnerName, "Bytewise")
  assert.equal(scheduled.storeName, "Sara Stores")
  assert.equal(scheduled.partnerUrl, "https://bytewiseconsulting.in/about")
  assert.equal(scheduled.storeUrl, "https://sarastores.com")
})
