#!/usr/bin/env node
/**
 * Lists unguarded write routes, split into "intentionally public" and
 * "should be admin-only", so guards go where they belong.
 *
 * Usage: node scripts/list-unguarded-writes.mjs
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
    else if (/^route\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const GUARDS = /requireAdmin|requireUser|requireVendor|checkAdminAuthorization|requireCron|getSession|getCurrentUserId|authenticatePartner|verifyApiKey/
const WRITE = /export\s+(async\s+)?(function|const)\s+(POST|PUT|PATCH|DELETE)/

// Storefront surfaces that must stay open to anonymous visitors.
const PUBLIC = [
  /^\/api\/auth\//,
  /^\/api\/v1\/auth\//,
  /^\/api\/contact$/,
  /^\/api\/contact-inquiries$/,
  /^\/api\/newsletter$/,
  /^\/api\/leads$/,
  /^\/api\/events$/,
  /^\/api\/vitals$/,
  /^\/api\/coupons\/(validate|redeem)$/,
  /^\/api\/employees\/validate$/,
  /^\/api\/lucky-draw\//,
  /^\/api\/spin-wheel\/(?!admin)/,
  /^\/api\/cart$/,
  /^\/api\/wishlist$/,
  /^\/api\/compare/,
  /^\/api\/reviews/,
  /^\/api\/complaints/,
  /^\/api\/orders$/,
  /^\/api\/payment\//,
  /^\/api\/unsubscribe/,
  /^\/api\/v1\/partner\//,
  /^\/api\/integrations\//,
  /^\/api\/cron\//,
  /^\/api\/products\/bulk$/,
  /^\/api\/store-qr\/scan\//,
]

const DEBUG = /\/(debug|test-|seed-|migrate|clear_database|direct-update)/

const rows = walk(API)
  .map((f) => {
    const src = readFileSync(f, "utf8")
    const route = "/" + relative(join(ROOT, "app"), dirname(f)).replace(/\\/g, "/")
    return { route, file: relative(ROOT, f), guarded: GUARDS.test(src), write: WRITE.test(src) }
  })
  .filter((r) => r.write && !r.guarded)

const publicOk = rows.filter((r) => PUBLIC.some((p) => p.test(r.route)))
const debugRoutes = rows.filter((r) => !PUBLIC.some((p) => p.test(r.route)) && DEBUG.test(r.route))
const needsGuard = rows.filter((r) => !PUBLIC.some((p) => p.test(r.route)) && !DEBUG.test(r.route))

console.log(`\n  ${rows.length} unguarded write routes\n`)
console.log(`  intentionally public (no guard wanted) : ${publicOk.length}`)
console.log(`  debug/seed/test (delete instead)       : ${debugRoutes.length}`)
console.log(`  NEEDS AN ADMIN GUARD                   : ${needsGuard.length}\n`)

console.log("  NEEDS AN ADMIN GUARD:")
for (const r of needsGuard) console.log(`    ${r.file}`)

console.log("\n  DEBUG / SEED / TEST (recommend deletion):")
for (const r of debugRoutes) console.log(`    ${r.file}`)
console.log("")
