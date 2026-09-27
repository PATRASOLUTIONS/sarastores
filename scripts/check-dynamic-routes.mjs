#!/usr/bin/env node
/**
 * Finds app-router pages and layouts that read cookies/headers (directly or
 * through getSession) but do not opt out of static prerendering.
 *
 * Next tries to prerender these at build time and throws DYNAMIC_SERVER_USAGE.
 *
 * Usage: node scripts/check-dynamic-routes.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const APP = join(ROOT, "app")

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === "api") continue // route handlers are always dynamic
      out.push(...walk(p))
    } else if (/^(page|layout)\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

// Anything that forces a request-time render.
const DYNAMIC_API = /\bcookies\s*\(|\bheaders\s*\(|getSession\s*\(|requireUser\s*\(|requireAdmin\s*\(|requireVendor\s*\(|getCurrentUserId\s*\(|checkAdminAuthorization\s*\(|draftMode\s*\(/
const OPTED_OUT = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']|export\s+const\s+revalidate\s*=\s*0/
const IS_CLIENT = /^\s*["']use client["']/m

const offenders = []
const safe = []

for (const file of walk(APP)) {
  const src = readFileSync(file, "utf8")
  if (IS_CLIENT.test(src)) continue // client components never prerender on the server this way
  if (!DYNAMIC_API.test(src)) continue

  const rel = relative(ROOT, file).replace(/\\/g, "/")
  const which = (src.match(DYNAMIC_API) || [""])[0].trim()
  if (OPTED_OUT.test(src)) safe.push({ rel, which })
  else offenders.push({ rel, which })
}

console.log(`\n  SERVER pages/layouts that read request state\n`)
console.log(`  already opted out of static prerender : ${safe.length}`)
console.log(`  NOT opted out (will throw at build)   : ${offenders.length}\n`)

if (offenders.length) {
  console.log("  NEEDS `export const dynamic = \"force-dynamic\"`:")
  for (const o of offenders) console.log(`    ${o.rel.padEnd(52)} uses ${o.which}`)
  console.log("")
}

if (safe.length) {
  console.log("  Already correct:")
  for (const s of safe) console.log(`    ${s.rel}`)
  console.log("")
}

process.exit(offenders.length ? 1 : 0)
