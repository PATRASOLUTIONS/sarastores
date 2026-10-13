import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { BulkOrderUploadSchema } from "@/lib/validation"
import { PUT as updateOrder } from "@/app/api/orders/[id]/route"

type BulkRow = z.infer<typeof BulkOrderUploadSchema>["rows"][number]
const successSchema = z.object({ id: z.string().min(1), status: z.string().min(1) })
const errorSchema = z.object({ error: z.string().optional(), message: z.string().optional() })

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = BulkOrderUploadSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const results: { success: BulkRow[]; failed: Array<{ row: BulkRow; error: string }> } = { success: [], failed: [] }
    for (let offset = 0; offset < parsed.data.rows.length; offset += 4) {
      const batch = parsed.data.rows.slice(offset, offset + 4)
      const outcomes = await Promise.all(batch.map(async row => {
        try {
          const response = await updateOrder(new NextRequest(request.url, {
            method: "PUT",
            headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
            body: JSON.stringify({ status: row.status, ...(row.trackingNumber ? { trackingNumber: row.trackingNumber } : {}) }),
          }), { params: Promise.resolve({ id: row.orderId }) })
          const data: unknown = await response.json()
          if (!response.ok) {
            const failure = errorSchema.safeParse(data)
            return { row, error: failure.success ? failure.data.error || failure.data.message || `Order update failed (HTTP ${response.status})` : `Invalid order error response (HTTP ${response.status})` }
          }
          const saved = successSchema.safeParse(data)
          if (!saved.success || saved.data.status !== row.status) return { row, error: "Order update returned an invalid acknowledgement" }
          return { row, error: null }
        } catch (error) {
          console.error("[Bulk Order Upload] Order update failed", error)
          return { row, error: "Order update failed unexpectedly" }
        }
      }))
      for (const outcome of outcomes) {
        if (outcome.error === null) results.success.push(outcome.row)
        else results.failed.push({ row: outcome.row, error: outcome.error })
      }
    }
    return NextResponse.json(results)
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    console.error("[Bulk Order Upload] Request failed", error)
    return NextResponse.json({ error: "Failed to process bulk order updates" }, { status: 500 })
  }
}
