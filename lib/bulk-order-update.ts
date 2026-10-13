import { z } from "zod"

const bulkOrderRowSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  trackingNumber: z.string().optional(),
  approved: z.boolean().optional(),
})
export type BulkOrderRow = z.infer<typeof bulkOrderRowSchema>
export const bulkOrderUpdateRequestSchema = z.object({ rows: z.array(bulkOrderRowSchema).min(1) })
export const bulkOrderUpdateResponseSchema = z.object({
  success: z.array(bulkOrderRowSchema),
  failed: z.array(z.object({ row: bulkOrderRowSchema, error: z.string() })),
  message: z.string(),
  notifications: z.object({
    sent: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
})
export type BulkOrderUpdateResult = z.infer<typeof bulkOrderUpdateResponseSchema>

export function normalizeBulkStatusRow(row: Record<string, unknown>): BulkOrderRow {
  const keys = Object.keys(row)
  const cell = (...candidates: string[]) => {
    const key = keys.find(value => candidates.includes(value.toLowerCase()))
    return key ? String(row[key] ?? "").trim() : ""
  }
  return {
    orderId: cell("order id", "orderid", "order", "id"),
    status: cell("status", "order status", "order_status"),
    trackingNumber: cell("tracking number", "tracking", "tracking_no", "tracking_number"),
  }
}

function rowKey(row: BulkOrderRow): string {
  return JSON.stringify([row.orderId, row.status, row.trackingNumber ?? ""])
}

export function removeSuccessfulBulkRows(rows: BulkOrderRow[], result: BulkOrderUpdateResult): BulkOrderRow[] {
  const approved = rows.filter(row => row.approved === true)
  const pending = new Map<string, number>()
  for (const row of approved) pending.set(rowKey(row), (pending.get(rowKey(row)) ?? 0) + 1)
  for (const row of [...result.success, ...result.failed.map(failure => failure.row)]) {
    const key = rowKey(row)
    const count = pending.get(key) ?? 0
    if (!count) throw new Error("Bulk update returned an unexpected or duplicate row")
    pending.set(key, count - 1)
  }
  const notificationCount = result.notifications.sent + result.notifications.failed + result.notifications.skipped
  if ([...pending.values()].some(count => count !== 0) || notificationCount !== result.success.length) {
    throw new Error("Bulk update returned incomplete results")
  }
  const successful = new Map<string, number>()
  for (const row of result.success) successful.set(rowKey(row), (successful.get(rowKey(row)) ?? 0) + 1)
  return rows.filter(row => {
    const key = rowKey(row)
    const count = successful.get(key) ?? 0
    if (row.approved === true && count > 0) {
      successful.set(key, count - 1)
      return false
    }
    return true
  })
}
