/**
 * Abandoned-cart recovery — Strategy 4.
 *
 * A rewrite of `lib/cron/abandoned-cart.ts`, which was never safe to enable:
 *   - it tracked send history in an in-memory Map, which is empty on every
 *     serverless invocation, so the rate limit never actually applied;
 *   - its hourly follow-up query had no cap, so a shopper with a stale cart would
 *     have been emailed every hour, forever;
 *   - it queried unbounded, ignored consent, and sent no unsubscribe link.
 *
 * This version keeps state in the database, caps recovery at two touches, and runs
 * through the same consent gate as every other retention message.
 */

import { getCollection, COLLECTIONS } from "@/lib/db-service"
import { sendEmail } from "@/lib/email"
import {
  COLLECTION_CUSTOMER_PROFILES,
  issueUnsubscribeToken,
  recordEvent,
} from "@/lib/customer-profile"
import {
  CART_FIRST_REMINDER_HOURS,
  CART_MAX_AGE_DAYS,
  CART_MAX_REMINDERS,
  CART_SECOND_REMINDER_HOURS,
} from "./rules"
import { buildReminderMessage } from "./messages"

const MAX_CARTS_PER_RUN = 200
const HOUR_MS = 60 * 60 * 1000

export type CartRunResult = {
  candidates: number
  sent: number
  failed: number
  skipped: { consent: number; noEmail: number; empty: number; capped: number; tooSoon: number }
  dryRun: boolean
}

export async function runCartRecovery(options: { dryRun?: boolean } = {}): Promise<CartRunResult> {
  const dryRun = options.dryRun ?? false
  const now = new Date()

  const carts = await getCollection("carts")
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)

  const firstDue = new Date(now.getTime() - CART_FIRST_REMINDER_HOURS * HOUR_MS)
  const oldestAllowed = new Date(now.getTime() - CART_MAX_AGE_DAYS * 24 * HOUR_MS)

  // Only carts that are stale, non-empty, owned by a signed-in user, still recent
  // enough to matter, and not already at the reminder cap.
  const candidates = await carts
    .find(
      {
        userId: { $nin: [null, ""] },
        updatedAt: { $lt: firstDue, $gte: oldestAllowed },
        "items.0": { $exists: true },
        $or: [
          { abandonmentEmailCount: { $exists: false } },
          { abandonmentEmailCount: { $lt: CART_MAX_REMINDERS } },
        ],
      },
      { projection: { userId: 1, items: 1, updatedAt: 1, abandonmentEmailCount: 1, lastAbandonmentEmailSent: 1 } },
    )
    .limit(MAX_CARTS_PER_RUN)
    .toArray()

  const skipped = { consent: 0, noEmail: 0, empty: 0, capped: 0, tooSoon: 0 }
  let sent = 0
  let failed = 0

  for (const cart of candidates) {
    const items = Array.isArray(cart.items) ? cart.items : []
    if (items.length === 0) {
      skipped.empty++
      continue
    }

    const count = Number(cart.abandonmentEmailCount) || 0
    if (count >= CART_MAX_REMINDERS) {
      skipped.capped++
      continue
    }

    // The second touch waits significantly longer than the first.
    const lastSent = cart.lastAbandonmentEmailSent
      ? new Date(cart.lastAbandonmentEmailSent as string | Date)
      : null
    if (count > 0) {
      const dueAt = new Date(
        (lastSent?.getTime() ?? 0) + (CART_SECOND_REMINDER_HOURS - CART_FIRST_REMINDER_HOURS) * HOUR_MS,
      )
      if (now < dueAt) {
        skipped.tooSoon++
        continue
      }
    }

    const userId = String(cart.userId)
    const profile = await profiles.findOne(
      { userId },
      { projection: { email: 1, "consent.email": 1 } },
    )

    if (!profile?.consent?.email) {
      skipped.consent++
      continue
    }
    if (!profile.email) {
      skipped.noEmail++
      continue
    }

    if (dryRun) {
      sent++
      continue
    }

    try {
      const token = await issueUnsubscribeToken(userId)
      const message = buildReminderMessage("abandoned_cart", {
        customerName: "there",
        productName: String(items[0]?.name ?? "an item"),
        category: null,
        purchasedAt: now,
        unsubscribeToken: token,
        extraItems: Math.max(0, items.length - 1),
      })
      if (!message) continue

      const result = await sendEmail({
        to: String(profile.email),
        subject: message.subject,
        html: message.html,
      })
      if (!result?.success) throw new Error("send failed")

      // Persisted, so the cap survives across serverless invocations.
      await carts.updateOne(
        { _id: cart._id },
        {
          $set: { lastAbandonmentEmailSent: now },
          $inc: { abandonmentEmailCount: 1 },
        },
      )
      await recordEvent(userId, "reminder_sent", {
        key: `abandoned_cart:${String(cart._id)}:${count}`,
        kind: "abandoned_cart",
      })
      sent++
    } catch {
      failed++
    }
  }

  return { candidates: candidates.length, sent, failed, skipped, dryRun }
}
