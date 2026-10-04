#!/usr/bin/env node
/**
 * Lists app-router pages/layouts that query MongoDB during the build.
 *
 * Static generation runs these on the BUILD machine, so if that machine cannot
 * reach Atlas (IP allowlist) every one of them fails and the deployment ships
 * incomplete — which surfaces as 404s.
 *
 * Usage: node scripts/check-build-time-db.mjs
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
      if (name === "api") continue
      out.push(...walk(p))
    } else if (/^(page|layout)\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

const DB = /connectToDatabase|getCollection\(|from ["']@\/lib\/db-service["']|from ["']@\/lib\/mongodb["']/
const FORCED_DYNAMIC = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/
const STATIC_PARAMS = /generateStaticParams/
const IS_CLIENT = /^\s*["']use client["']/m

const dbPages = []
const staticParams = []

for (const file of walk(APP)) {
  const src = readFileSync(file, "utf8")
  const rel = relative(ROOT, file).replace(/\\/g, "/")
  if (STATIC_PARAMS.test(src)) staticParams.push(rel)
  if (IS_CLIENT.test(src)) continue
  if (DB.test(src)) {
    dbPages.push({ rel, forced: FORCED_DYNAMIC.test(src) })
  }
}

const willPrerender = dbPages.filter((p) => !p.forced)

console.log(`\n  Pages/layouts that query MongoDB : ${dbPages.length}`)
console.log(`    already force-dynamic (skipped at build) : ${dbPages.length - willPrerender.length}`)
console.log(`    WILL run against Mongo during the build  : ${willPrerender.length}\n`)

for (const p of willPrerender) console.log(`    ${p.rel}`)

console.log(`\n  generateStaticParams (multiplies prerendered pages): ${staticParams.length}`)
for (const s of staticParams) console.log(`    ${s}`)

if (willPrerender.length) {
  console.log(`\n  >> The build machine must be able to reach MongoDB Atlas.`)
  console.log(`     On Vercel that means Network Access must allow 0.0.0.0/0,`)
  console.log(`     because build IPs are dynamic. If it cannot connect, these`)
  console.log(`     pages fail during static generation.\n`)
}
