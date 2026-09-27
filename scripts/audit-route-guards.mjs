#!/usr/bin/env node
/**
 * Static security audit: which API routes defend themselves, and which are
 * relying entirely on middleware.ts to be safe.
 *
 * Usage: node scripts/audit-route-guards.mjs
 */
import { readdirSync, statSync, readFileSync } from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const API = join(ROOT, "app", "api")

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name === "route.ts" || name === "route.tsx") out.push(p)
  }
  return out
}

const GUARDS = /requireAdmin|requireUser|requireVendor|checkAdminAuthorization|requireCron|getSession|getCurrentUserId|authenticatePartner|verifyApiKey/
const WRITE_METHODS = /export\s+(async\s+)?(function|const)\s+(POST|PUT|PATCH|DELETE)/

const files = walk(API)
const rows = files.map((f) => {
  const src = readFileSync(f, "utf8")
  const route = "/" + relative(join(ROOT, "app"), dirname(f)).replace(/\\/g, "/")
  return {
    route,
    guarded: GUARDS.test(src),
    hasWrite: WRITE_METHODS.test(src),
    isPartner: route.startsWith("/api/v1/partner"),
    isCron: route.startsWith("/api/cron"),
    isDebug: /\/(debug|test-|seed-|migrate|clear_database|direct-update)/.test(route),
    isAdmin: route.startsWith("/api/admin") || /\/admin\//.test(route),
  }
})

const unguarded = rows.filter((r) => !r.guarded)
const unguardedWrites = unguarded.filter((r) => r.hasWrite)
const unguardedAdmin = unguarded.filter((r) => r.isAdmin)
const unguardedDebug = rows.filter((r) => r.isDebug && !r.guarded)

console.log(`\n  ROUTE GUARD AUDIT — ${files.length} API route files\n`)
console.log(`  guarded in-handler : ${rows.length - unguarded.length}`)
console.log(`  NOT guarded        : ${unguarded.length}`)
console.log(`  ...of those, with a write method (POST/PUT/PATCH/DELETE): ${unguardedWrites.length}`)
console.log(`  ...of those, under an admin path                        : ${unguardedAdmin.length}`)
console.log(`  unguarded debug/seed/test routes                        : ${unguardedDebug.length}`)

if (unguardedAdmin.length) {
  console.log(`\n  ADMIN ROUTES WITH NO IN-HANDLER GUARD (middleware is the only thing stopping you):`)
  for (const r of unguardedAdmin) console.log(`    ${r.hasWrite ? "W" : " "}  ${r.route}`)
}

if (unguardedDebug.length) {
  console.log(`\n  UNGUARDED DEBUG / SEED / TEST ROUTES:`)
  for (const r of unguardedDebug) console.log(`    ${r.hasWrite ? "W" : " "}  ${r.route}`)
}

console.log(`\n  UNGUARDED WRITE ROUTES (first 40):`)
for (const r of unguardedWrites.slice(0, 40)) console.log(`       ${r.route}`)
if (unguardedWrites.length > 40) console.log(`       ... and ${unguardedWrites.length - 40} more`)
console.log("")
