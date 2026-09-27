#!/usr/bin/env node
/**
 * Compares every process.env variable the code reads against what is defined
 * locally, so a deploy does not fail on a missing value.
 *
 * Prints NAMES and set/unset only — never values.
 *
 * Usage: node scripts/check-env-completeness.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "mobile", "archive", ".expo", "public", "docs"])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p)
  }
  return out
}

// Collect every referenced variable.
const referenced = new Map()
for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8")
  for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
    const name = m[1]
    if (!referenced.has(name)) referenced.set(name, new Set())
    referenced.get(name).add(file.slice(ROOT.length + 1).replace(/\\/g, "/"))
  }
}

// Parse the local env files.
function parseEnv(p) {
  const out = new Set()
  if (!existsSync(p)) return out
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && m[2].trim() !== "") out.add(m[1])
  }
  return out
}

const envFiles = [".env", ".env.local", ".env.production"]
const defined = new Set()
const perFile = {}
for (const f of envFiles) {
  const s = parseEnv(join(ROOT, f))
  perFile[f] = s.size
  for (const k of s) defined.add(k)
}

// Values Next.js / Vercel inject automatically.
const BUILTIN = new Set([
  "NODE_ENV", "NEXT_RUNTIME", "VERCEL", "VERCEL_URL", "VERCEL_ENV",
  "VERCEL_REGION", "VERCEL_GIT_COMMIT_SHA", "PORT", "ANALYZE", "CI",
])

const names = [...referenced.keys()].sort()
const missing = names.filter((n) => !defined.has(n) && !BUILTIN.has(n))
const present = names.filter((n) => defined.has(n))

console.log(`\n  env files found: ${envFiles.map((f) => `${f}(${perFile[f]})`).join("  ")}`)
console.log(`  variables referenced in code : ${names.length}`)
console.log(`  defined locally              : ${present.length}`)
console.log(`  NOT defined                  : ${missing.length}\n`)

// Anything gating a payment, database or auth path is a hard requirement.
const CRITICAL = /MONGODB|SESSION_SECRET|NEXTAUTH_SECRET|RAZORPAY|CRON_SECRET|SMTP|EMAIL_FROM|ENCRYPTION|API_KEY_/
const criticalMissing = missing.filter((n) => CRITICAL.test(n))

if (criticalMissing.length) {
  console.log("  MISSING AND CRITICAL:")
  for (const n of criticalMissing) console.log(`    ${n.padEnd(34)} ${[...referenced.get(n)].slice(0, 2).join(", ")}`)
  console.log("")
}

const optionalMissing = missing.filter((n) => !CRITICAL.test(n))
if (optionalMissing.length) {
  console.log("  MISSING (feature degrades, app still boots):")
  for (const n of optionalMissing) console.log(`    ${n.padEnd(34)} ${[...referenced.get(n)].slice(0, 2).join(", ")}`)
  console.log("")
}

// These must exist in the hosting platform's settings, not just .env.
console.log("  MUST BE SET IN THE HOST'S ENVIRONMENT (not just .env):")
for (const n of ["MONGODB_URI", "SESSION_SECRET", "CRON_SECRET", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]) {
  console.log(`    ${n.padEnd(34)} ${defined.has(n) ? "defined locally" : "NOT DEFINED LOCALLY"}`)
}
console.log("")
