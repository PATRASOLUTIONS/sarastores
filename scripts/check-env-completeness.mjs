#!/usr/bin/env node
// Read-only audit. Outputs names/status only; never credential values.
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"
import { checkDeploymentEnvironment } from "./check-deployment-env.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceRoots = ["app", "lib", "components", "contexts", "hooks", "utils"]
const referenced = new Set()
function scan(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) scan(file)
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      const text = readFileSync(file, "utf8")
      for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)|process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g)) referenced.add(match[1] || match[2])
    }
  }
}
for (const dir of sourceRoots) scan(join(ROOT, dir))
for (const name of ["DIWALI_APPROVED_TEMPLATE_EN", "DIWALI_APPROVED_TEMPLATE_KN", "DIWALI_DISPATCH_TEMPLATE_EN", "DIWALI_DISPATCH_TEMPLATE_KN"]) referenced.add(name)
const files = [".env", ".env.local"]
const parsed = Object.fromEntries(files.map(name => [name, existsSync(join(ROOT, name)) ? parseEnv(readFileSync(join(ROOT, name), "utf8")) : {}]))
const effective = { ...parsed[".env"], ...parsed[".env.local"] }
const builtins = new Set(["NODE_ENV", "NEXT_RUNTIME", "VERCEL", "VERCEL_URL", "VERCEL_ENV", "VERCEL_REGION", "VERCEL_GIT_COMMIT_SHA", "VERCEL_PROJECT_PRODUCTION_URL", "PORT", "CI", "NEXT_PHASE"])
const missing = [...referenced].filter(name => !builtins.has(name) && !effective[name]?.trim()).sort()
const errors = checkDeploymentEnvironment(effective).map(message => {
  for (const value of Object.values(effective).filter(value => value.length >= 6).sort((a, b) => b.length - a.length)) message = message.split(value).join("[configured value]")
  return message.replace(/"[^"]*"/g, '[configured value]')
})
const report = {
  checkedAt: new Date().toISOString(), scope: "Local files only; hosted Vercel variables are unverified.",
  files: Object.fromEntries(files.map(name => [name, { assignments: Object.keys(parsed[name]).length, emptyKeys: Object.keys(parsed[name]).filter(key => !parsed[name][key].trim()).sort() }])),
  runtimeVariablesReferenced: referenced.size,
  productionConfigurationIssues: errors,
  unconfiguredFeatureOrFallbackVariables: missing,
  note: "Unconfigured optional variables are not all required. Aliases, platform-injected values and disabled integrations need different treatment; the production checks above identify current blockers.",
}
if (process.argv.includes("--report")) {
  const target = join(ROOT, "documents/integrations/environment-audit.json")
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n", "utf8")
  console.log("Sanitized audit saved to documents/integrations/environment-audit.json")
}
console.log(JSON.stringify(report, null, 2))
