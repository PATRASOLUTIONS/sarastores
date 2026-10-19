/**
 * List API routes that read a request body without validating its shape.
 *
 * CLAUDE.md records that only about 5 routes used lib/validation.ts. An
 * unvalidated body reaches MongoDB as whatever the caller sent, so a wrong type
 * is a 500 at best and an operator-visible bad document at worst.
 */

import fs from "node:fs"
import path from "node:path"

const API_ROOT = path.resolve("app/api")
const VALIDATED = /safeParse|\.parse\(|from ["']zod["']|@\/lib\/validation/

function routeFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...routeFiles(full))
    else if (entry.name === "route.ts") out.push(full)
  }
  return out
}

let bodyRoutes = 0
const missing = []

for (const file of routeFiles(API_ROOT)) {
  const source = fs.readFileSync(file, "utf8")
  if (!/export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH)\b/.test(source)) continue
  // Only routes that actually read a body can validate one.
  if (!/request\.(?:json|text|formData)\s*\(/.test(source)) continue
  bodyRoutes++
  if (VALIDATED.test(source)) continue
  missing.push("/" + path.relative(path.resolve("app"), path.dirname(file)).split(path.sep).join("/"))
}

console.log(`${bodyRoutes} routes read a request body; ${bodyRoutes - missing.length} validate it, ${missing.length} do not:\n`)
for (const route of missing.sort()) console.log(`  ${route}`)
