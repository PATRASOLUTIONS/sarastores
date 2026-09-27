import { type NextRequest, NextResponse } from "next/server"
import { getCollection, COLLECTIONS } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { requireCron } from "@/lib/cron-auth"
import { rebuildCustomerProfile, EARNING_STATUSES } from "@/lib/customer-profile"

export const dynamic = "force-dynamic"

/** Bounded so a single invocation cannot exceed the serverless execution limit. */
const MAX_USERS_PER_RUN = 500

/**
 * Rebuilds customer profiles from order history.
 *
 * Runs nightly. Rebuilding is idempotent, so a retry or overlapping run is safe.
 */
export async function POST(request: NextRequest) {
  const guard = requireCron(request)
  if (!guard.ok) return guard.response

  try {
    const orders = await getCollection(COLLECTIONS.ORDERS)

    // Only customers with realised orders need a rollup.
    const userIds = (await orders.distinct("userId", {
      userId: { $nin: [null, ""] },
      status: { $in: [...EARNING_STATUSES] },
    })) as string[]

    const batch = userIds.slice(0, MAX_USERS_PER_RUN)

    let rebuilt = 0
    let failed = 0
    for (const userId of batch) {
      try {
        await rebuildCustomerProfile(String(userId))
        rebuilt++
      } catch {
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      totalCustomers: userIds.length,
      processed: batch.length,
      rebuilt,
      failed,
      truncated: userIds.length > batch.length,
    })
  } catch (error) {
    return handleApiError(error, "Failed to rebuild customer profiles")
  }
}

/** Vercel Cron issues GET requests; delegate so one handler serves both. */
export async function GET(request: NextRequest) {
  return POST(request)
}
