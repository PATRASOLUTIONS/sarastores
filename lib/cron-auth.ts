/**
 * Shared authentication for scheduled jobs.
 *
 * Cron endpoints are public URLs, so they must authenticate themselves. Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`; we also accept `x-cron-secret` so the
 * same routes can be triggered by an external scheduler or run manually.
 *
 * Without `CRON_SECRET` set the routes refuse to run rather than defaulting open —
 * an unauthenticated job that rewrites customer records is a far worse failure than
 * a job that does not run.
 */

import { type NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

type CronOk = { ok: true }
type CronFail = { ok: false; response: NextResponse }

/**
 * A missing secret is the single most common reason scheduled jobs silently
 * never run: Vercel only sends the bearer header when `CRON_SECRET` is set on
 * the project, so without it every invocation is refused. Log it loudly once
 * per instance so the cause is visible in the platform logs instead of looking
 * like the schedule never fired.
 */
let warnedAboutMissingSecret = false

export function requireCron(request: NextRequest): CronOk | CronFail {
  const secret = process.env.CRON_SECRET

  if (!secret || secret.length < 16) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true
      console.error(
        "[cron] CRON_SECRET is " +
          (secret ? `only ${secret.length} characters; 16 are required` : "not set") +
          ". Every scheduled job will be refused with 503 until it is configured " +
          "in the deployment environment.",
      )
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Cron is not configured" },
        { status: 503 },
      ),
    }
  }

  const header = request.headers.get("authorization") ?? ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : ""
  const custom = request.headers.get("x-cron-secret") ?? ""
  const provided = bearer || custom

  if (!provided || !safeEqual(provided, secret)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { ok: true }
}
