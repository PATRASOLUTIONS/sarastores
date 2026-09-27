#!/usr/bin/env node
/**
 * Verifies every scheduled job in vercel.json is reachable, authenticated and
 * actually executes.
 *
 * SAFETY: messaging jobs are invoked with ?dryRun=1 so no customer email or
 * WhatsApp message is sent. Jobs without a dry-run mode are only checked for
 * auth behaviour, never executed.
 *
 * Usage: CRON_SECRET=.. node scripts/verify-cron-jobs.mjs <url>
 */
const BASE = (process.argv[2] || "http://localhost:3005").replace(/\/$/, "")
const SECRET = process.env.CRON_SECRET

if (!SECRET) {
  console.error("CRON_SECRET is not set")
  process.exit(1)
}

// dryRun=true means the job can be executed safely here.
const JOBS = [
  { path: "/api/cron/rebuild-profiles", schedule: "0 1 * * *", dryRun: false },
  { path: "/api/cron/segment-customers", schedule: "30 1 * * *", dryRun: false },
  { path: "/api/cron/cart-recovery", schedule: "0 3 * * *", dryRun: true },
  { path: "/api/cron/wishlist-alerts", schedule: "30 4 * * *", dryRun: true },
  { path: "/api/cron/lifecycle-reminders", schedule: "30 5 * * *", dryRun: true },
]

let pass = 0
let fail = 0
const problems = []
const report = (ok, label, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)} ${detail}`)
  ok ? pass++ : fail++
  if (!ok) problems.push(`${label} — ${detail}`)
}

console.log(`\n  SCHEDULED JOB VERIFICATION against ${BASE}\n`)

// vercel.json is the only thing that actually schedules anything.
const { readFileSync } = await import("node:fs")
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"))
const scheduled = new Set((vercel.crons || []).map((c) => c.path))

console.log("  1. Every job is registered in vercel.json")
for (const job of JOBS) {
  report(scheduled.has(job.path), job.path, scheduled.has(job.path) ? job.schedule : "NOT SCHEDULED")
}

console.log("\n  2. Unauthenticated callers are rejected")
for (const job of JOBS) {
  const res = await fetch(BASE + job.path, { signal: AbortSignal.timeout(60_000) })
  report([401, 403].includes(res.status), job.path, String(res.status))
}

console.log("\n  3. A wrong secret is rejected")
{
  const res = await fetch(BASE + JOBS[0].path, {
    headers: { authorization: "Bearer " + "x".repeat(SECRET.length) },
    signal: AbortSignal.timeout(60_000),
  })
  report(res.status === 401, "wrong secret -> 401", String(res.status))
}

console.log("\n  4. Vercel Cron sends GET — the routes must accept it")
for (const job of JOBS) {
  if (!job.dryRun) {
    console.log(`  skip  ${job.path.padEnd(58)} no dry-run mode, not executed`)
    continue
  }
  const started = Date.now()
  try {
    const res = await fetch(`${BASE}${job.path}?dryRun=1`, {
      headers: { authorization: `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(120_000),
    })
    const body = await res.json().catch(() => ({}))
    const ok = res.ok && body?.success !== false
    report(ok, `GET ${job.path}?dryRun=1`, `${res.status} ${Date.now() - started}ms ${JSON.stringify(body).slice(0, 90)}`)
  } catch (e) {
    report(false, `GET ${job.path}?dryRun=1`, e.message)
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`)
if (problems.length) {
  console.log("\n  PROBLEMS:")
  for (const p of problems) console.log(`    ${p}`)
}
console.log("")
process.exit(fail ? 1 : 0)
