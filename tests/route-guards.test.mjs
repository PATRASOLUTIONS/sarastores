import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

/**
 * CLAUDE.md rule 1: every route handler establishes who the caller is, rather
 * than trusting middleware.ts. The middleware policy table matches by prefix,
 * so any new path outside those prefixes is open by default — which is exactly
 * the mistake this test is here to catch.
 *
 * A handful of mutating routes are anonymous on purpose: you cannot hold a
 * session while logging in, and public forms and telemetry have no caller to
 * identify. Those are listed below with the reason. Adding a new mutating route
 * fails this test until it either takes a guard or is justified here.
 */

const REPO = path.resolve(import.meta.dirname, "..")
const API_ROOT = path.join(REPO, "app/api")
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"]

const GUARDS = [
  // lib/auth.ts
  /requireAdmin\s*\(/, /requireFullAdmin\s*\(/, /requireUser\s*\(/, /requireVendor\s*\(/,
  /checkAdminAuthorization\s*\(/, /getCurrentUser\s*\(/, /getCurrentUserId\s*\(/,
  /getSession\s*\(/, /isAdmin\s*\(/,
  // Callers that hold something other than a session: cron, partner API keys,
  // mobile access tokens, guest order tokens.
  /requireCron\s*\(/, /withPartnerAuth\s*[(<]/, /authenticatePartner\s*\(/, /validateAPIKey\s*\(/,
  /verifyGuestAccessToken\s*\(/, /verifyPendingSignupToken\s*\(/, /verifyAccessToken\s*\(/,
  // Webhooks authenticate by signature.
  /verifyWebhookSignature|verifyRazorpaySignature|verifyPartnerPayment|createHmac\s*\(|timingSafeEqual\s*\(/,
]

/** route -> why it is reachable without an identified caller. */
const INTENTIONALLY_PUBLIC = {
  "/api/auth/login": "issues the session; cannot require one",
  "/api/auth/logout": "clears the cookie; must work with an expired session",
  "/api/auth/signup": "creates the account",
  "/api/auth/forgot-password": "pre-auth by definition; answers generically either way",
  "/api/auth/reset-password": "authenticated by the emailed reset token",
  "/api/v1/auth/login": "mobile sign-in; issues the token",
  "/api/v1/auth/google": "mobile Google sign-in; issues the token",
  "/api/v1/auth/refresh": "authenticated by the refresh token it is handed",
  "/api/contact": "public contact form; Zod-validated and the recipient is server-side",
  "/api/newsletter": "public subscribe form",
  "/api/unsubscribe": "authenticated by the per-recipient unsubscribe token",
  "/api/vitals": "anonymous Web Vitals beacon; middleware allows it explicitly",
  "/api/employees/validate": "in-store checkout reads an employee ID before the customer logs in",
  "/api/v1/partner/register": "partner self-registration; the API key does not exist yet",
  "/api/spin-wheel/register": "public campaign entry; mints the per-participant spin token",
  "/api/spin-wheel/track": "public campaign visit counter",
  "/api/spin-wheel/otp/send": "public campaign entry; rate limited per address",
  "/api/spin-wheel/otp/verify": "public campaign entry; the OTP is the credential",
  "/api/lucky-draw/[token]/draw": "the 32-hex draw token is the capability; event screens run without a login",
  "/api/lucky-draw/[token]/notify": "same token; idempotent, one email per winner",
  "/api/payment/[provider]/webhook": "provider callback; the payload is a hint and state is re-fetched with server credentials",
  "/api/payment/[provider]/return": "browser return from the hosted page; state is re-fetched with server credentials",
}

function routeFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...routeFiles(full))
    else if (entry.name === "route.ts" || entry.name === "route.tsx") out.push(full)
  }
  return out
}

test("every mutating API route identifies its caller, or is listed as public with a reason", () => {
  const unguarded = []

  for (const file of routeFiles(API_ROOT)) {
    const source = fs.readFileSync(file, "utf8")
    const mutates = MUTATING.some(method =>
      new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${method}\\b`).test(source))
    if (!mutates) continue
    if (GUARDS.some(pattern => pattern.test(source))) continue

    unguarded.push("/" + path.relative(path.join(REPO, "app"), path.dirname(file)).split(path.sep).join("/"))
  }

  const unexpected = unguarded.filter(route => !(route in INTENTIONALLY_PUBLIC))
  assert.deepEqual(
    unexpected,
    [],
    `These routes mutate state without identifying the caller. Add a guard from lib/auth.ts, or ` +
      `if the route is genuinely public, record why in INTENTIONALLY_PUBLIC:\n  ${unexpected.join("\n  ")}`,
  )

  // Keep the allowlist honest: once a route takes a guard, its entry should go.
  const stale = Object.keys(INTENTIONALLY_PUBLIC).filter(route => !unguarded.includes(route))
  assert.deepEqual(stale, [], `No longer unguarded; remove from INTENTIONALLY_PUBLIC:\n  ${stale.join("\n  ")}`)
})
