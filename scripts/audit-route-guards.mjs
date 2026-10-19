/**
 * List mutating API routes that never establish who the caller is.
 *
 * middleware.ts carries a path+method policy table that covers most of the API,
 * but it matches by prefix, so a path outside those prefixes is open by
 * default. CLAUDE.md's rule 1 is that every handler guards itself regardless.
 *
 * A route counts as guarded if it calls one of the auth helpers, authenticates
 * a partner API key, verifies a cron secret, or verifies a payment-provider
 * webhook signature. Reported routes mutate state with none of those.
 */

import fs from "node:fs"
import path from "node:path"

const API_ROOT = path.resolve("app/api")
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"]

const GUARDS = [
  // lib/auth.ts
  /requireAdmin\s*\(/,
  /requireFullAdmin\s*\(/,
  /requireUser\s*\(/,
  /requireVendor\s*\(/,
  /checkAdminAuthorization\s*\(/,
  /getCurrentUser\s*\(/,
  /getCurrentUserId\s*\(/,
  /getSession\s*\(/,
  /isAdmin\s*\(/,
  // Non-session callers: cron, partner API keys, mobile and guest tokens.
  /requireCron\s*\(/,
  /withPartnerAuth\s*[(<]/,
  /authenticatePartner\s*\(/,
  /validateAPIKey\s*\(/,
  /verifyGuestAccessToken\s*\(/,
  /verifyPendingSignupToken\s*\(/,
  /verifyAccessToken\s*\(/,
  // Webhooks authenticate by signature rather than by session.
  /verifyWebhookSignature|verifyRazorpaySignature|verifyPartnerPayment|createHmac\s*\(|timingSafeEqual\s*\(/,
]

function routeFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...routeFiles(full))
    else if (entry.name === "route.ts" || entry.name === "route.tsx") out.push(full)
  }
  return out
}

const files = routeFiles(API_ROOT)
const unguarded = []

for (const file of files) {
  const source = fs.readFileSync(file, "utf8")
  const methods = MUTATING.filter(m => new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${m}\\b`).test(source))
  if (methods.length === 0) continue
  if (GUARDS.some(pattern => pattern.test(source))) continue

  unguarded.push({
    route: "/" + path.relative(path.resolve("app"), path.dirname(file)).split(path.sep).join("/"),
    file: path.relative(process.cwd(), file).split(path.sep).join("/"),
    methods,
  })
}

const mutating = files.filter(f => {
  const source = fs.readFileSync(f, "utf8")
  return MUTATING.some(m => new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${m}\\b`).test(source))
}).length

console.log(`${files.length} route files, ${mutating} of them mutating, ${unguarded.length} mutating with no caller identity:\n`)
for (const r of unguarded.sort((a, b) => a.route.localeCompare(b.route))) {
  console.log(`  ${r.methods.join(",").padEnd(18)} ${r.route}`)
}
