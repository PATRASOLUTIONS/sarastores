#!/usr/bin/env node
/**
 * Distinguishes "domain is not attached to this deployment" from
 * "deployment serves but pages fail".
 *
 * Static files (robots.txt, sitemap.xml) are emitted by the build and served
 * straight from Vercel's CDN with no runtime involved. If those 404 too, the
 * domain is not pointing at this build at all.
 *
 * Usage: node scripts/diagnose-404.mjs [host]
 */
const HOST = (process.argv[2] || "https://www.sarastores.com").replace(/\/$/, "")

const PATHS = [
  ["/robots.txt", "static file from the build"],
  ["/sitemap.xml", "static file from the build"],
  ["/manifest.webmanifest", "static file from the build"],
  ["/feed.xml", "static file from the build"],
  ["/", "home page (dynamic)"],
  ["/products", "products page (dynamic)"],
  ["/api/health", "API route (middleware runs)"],
  ["/api/theme", "API route (middleware runs)"],
  ["/nonexistent-path-xyz", "should 404 - control"],
]

console.log(`\n  DIAGNOSING ${HOST}\n`)
console.log(`  ${"path".padEnd(26)} ${"status".padEnd(7)} ${"vercel-error".padEnd(30)} note`)

const results = []
for (const [path, note] of PATHS) {
  try {
    const res = await fetch(HOST + path, { redirect: "manual", signal: AbortSignal.timeout(20_000) })
    const err = res.headers.get("x-vercel-error") || ""
    results.push({ path, status: res.status, err })
    console.log(`  ${path.padEnd(26)} ${String(res.status).padEnd(7)} ${err.padEnd(30)} ${note}`)
  } catch (e) {
    results.push({ path, status: 0, err: e.message })
    console.log(`  ${path.padEnd(26)} ${"ERR".padEnd(7)} ${String(e.message).slice(0, 30).padEnd(30)} ${note}`)
  }
}

const statics = results.filter((r) => /robots|sitemap|manifest|feed/.test(r.path))
const staticsOk = statics.filter((r) => r.status === 200).length
const middlewareFailed = results.some((r) => r.err === "MIDDLEWARE_INVOCATION_FAILED")

console.log(`\n  VERDICT\n`)
if (staticsOk === 0) {
  console.log(`  Static files from the build also 404.`)
  console.log(`  -> The domain is NOT attached to the project that produced this build,`)
  console.log(`     or no deployment has been promoted to Production.`)
  console.log(`     Check: Vercel -> Project -> Domains, and Deployments -> is one marked "Production"?`)
} else {
  console.log(`  ${staticsOk}/${statics.length} static files serve, so the deployment IS attached.`)
  console.log(`  -> The 404 is coming from the app, not from domain routing.`)
}

if (middlewareFailed) {
  console.log(`\n  Middleware is still crashing -> SESSION_SECRET is not set (or not applied yet).`)
  console.log(`  Env var changes require a REDEPLOY; editing them alone does nothing.`)
}
console.log("")
