import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { getCollection, COLLECTIONS } from "@/lib/db-service"
import { EARNING_STATUSES } from "@/lib/customer-profile"

export const dynamic = "force-dynamic"

/**
 * Aggregated figures for the admin dashboard.
 *
 * Everything is computed in MongoDB rather than by shipping the whole `orders`
 * and `products` collections to the browser, which is what the dashboard used
 * to do. One request, one date range, no client-side arithmetic.
 */

const TZ = "Asia/Kolkata"

/** Realised revenue only — a cancelled or pending order is not money. */
const EARNED = EARNING_STATUSES.map((s) => s.toLowerCase())
const LOST = ["cancelled", "canceled", "returned", "refunded"]

/** `createdAt` is a Date on new orders but a string on older ones. */
const AS_DATE = {
  $convert: { input: "$createdAt", to: "date", onError: null, onNull: null },
}

const LOWER_STATUS = { $toLower: { $ifNull: ["$status", "pending"] } }

function parseRange(url: URL) {
  const toParam = url.searchParams.get("to")
  const fromParam = url.searchParams.get("from")

  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date()
  const from = fromParam
    ? new Date(`${fromParam}T00:00:00.000Z`)
    : new Date(to.getTime() - 29 * 86400000)

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  if (from > to) return null

  // Equal-length window immediately before, for period-on-period deltas.
  const span = to.getTime() - from.getTime()
  return { from, to, prevFrom: new Date(from.getTime() - span - 1), prevTo: new Date(from.getTime() - 1) }
}

async function orderTotals(from: Date, to: Date) {
  const orders = await getCollection(COLLECTIONS.ORDERS)
  const rows = await orders
    .aggregate([
      { $addFields: { _at: AS_DATE } },
      { $match: { _at: { $gte: from, $lte: to } } },
      { $group: { _id: LOWER_STATUS, count: { $sum: 1 }, value: { $sum: { $ifNull: ["$total", 0] } } } },
    ])
    .toArray()

  let revenue = 0
  let orderCount = 0
  let earnedCount = 0
  let pipeline = 0
  let lost = 0
  const byStatus: { status: string; count: number; value: number }[] = []

  for (const r of rows) {
    const status = String(r._id ?? "pending")
    const value = Number(r.value ?? 0)
    orderCount += r.count
    byStatus.push({ status, count: r.count, value })
    if (EARNED.includes(status)) {
      revenue += value
      earnedCount += r.count
    } else if (LOST.includes(status)) {
      lost += value
    } else {
      pipeline += value
    }
  }

  byStatus.sort((a, b) => b.count - a.count)
  return {
    revenue,
    orderCount,
    pipeline,
    lost,
    averageOrderValue: earnedCount > 0 ? revenue / earnedCount : 0,
    byStatus,
  }
}

export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const range = parseRange(new URL(request.url))
    if (!range) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }
    const { from, to, prevFrom, prevTo } = range

    const [orders, products, users] = await Promise.all([
      getCollection(COLLECTIONS.ORDERS),
      getCollection(COLLECTIONS.PRODUCTS),
      getCollection(COLLECTIONS.USERS),
    ])

    const inRange = [
      { $addFields: { _at: AS_DATE } },
      { $match: { _at: { $gte: from, $lte: to } } },
    ]

    const [
      current,
      previous,
      daily,
      payments,
      topProducts,
      recent,
      productCount,
      activeProducts,
      lowStock,
      customerCount,
      newCustomers,
    ] = await Promise.all([
      orderTotals(from, to),
      orderTotals(prevFrom, prevTo),

      orders
        .aggregate([
          ...inRange,
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$_at", timezone: TZ } },
              orders: { $sum: 1 },
              revenue: {
                $sum: { $cond: [{ $in: [LOWER_STATUS, EARNED] }, { $ifNull: ["$total", 0] }, 0] },
              },
              booked: { $sum: { $ifNull: ["$total", 0] } },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: "$_id", orders: 1, revenue: 1, booked: 1 } },
        ])
        .toArray(),

      orders
        .aggregate([
          ...inRange,
          {
            $group: {
              _id: { $toLower: { $ifNull: ["$paymentMethod", "unknown"] } },
              count: { $sum: 1 },
              value: { $sum: { $ifNull: ["$total", 0] } },
            },
          },
          { $sort: { value: -1 } },
          { $project: { _id: 0, method: "$_id", count: 1, value: 1 } },
        ])
        .toArray(),

      // Ranked by units actually sold, not by how much stock is sitting unsold.
      orders
        .aggregate([
          ...inRange,
          { $unwind: "$items" },
          {
            $group: {
              _id: { $ifNull: ["$items.name", "Unknown"] },
              units: { $sum: { $ifNull: ["$items.quantity", 1] } },
              revenue: {
                $sum: {
                  $multiply: [{ $ifNull: ["$items.price", 0] }, { $ifNull: ["$items.quantity", 1] }],
                },
              },
              image: { $first: "$items.image" },
              productId: { $first: "$items.id" },
            },
          },
          { $sort: { units: -1 } },
          { $limit: 8 },
          { $project: { _id: 0, name: "$_id", units: 1, revenue: 1, image: 1, productId: 1 } },
        ])
        .toArray(),

      orders
        .aggregate([
          ...inRange,
          { $sort: { _at: -1 } },
          { $limit: 8 },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              orderId: 1,
              status: 1,
              total: 1,
              createdAt: "$_at",
              customerName: {
                $ifNull: ["$customer.name", { $ifNull: ["$shippingAddress.name", "Guest"] }],
              },
            },
          },
        ])
        .toArray(),

      products.countDocuments({}),
      products.countDocuments({ active: true }),
      products.countDocuments({ active: true, stock: { $lte: 5 } }),
      users.countDocuments({ role: { $ne: "admin" } }),
      users
        .aggregate([
          { $match: { role: { $ne: "admin" } } },
          { $addFields: { _at: AS_DATE } },
          { $match: { _at: { $gte: from, $lte: to } } },
          { $count: "n" },
        ])
        .toArray()
        .then((r) => r[0]?.n ?? 0),
    ])

    const delta = (now: number, before: number) =>
      before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null

    return NextResponse.json({
      success: true,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        revenue: current.revenue,
        orders: current.orderCount,
        averageOrderValue: current.averageOrderValue,
        pipeline: current.pipeline,
        lost: current.lost,
        products: productCount,
        activeProducts,
        lowStock,
        customers: customerCount,
        newCustomers,
      },
      deltas: {
        revenue: delta(current.revenue, previous.revenue),
        orders: delta(current.orderCount, previous.orderCount),
        averageOrderValue: delta(current.averageOrderValue, previous.averageOrderValue),
      },
      byStatus: current.byStatus,
      daily,
      payments,
      topProducts,
      recent,
    })
  } catch (error) {
    return handleApiError(error, "Failed to load dashboard")
  }
}
