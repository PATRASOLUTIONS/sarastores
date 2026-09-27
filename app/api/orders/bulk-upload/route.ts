import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"

type BulkRow = {
  orderId: string
  status: string
  trackingNumber?: string
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const payload = await req.json()
    const rows: BulkRow[] = payload?.rows || []
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ message: "No rows provided" }, { status: 400 })
    }

    const host = req.headers.get("host") || "localhost:3000"
    const proto = req.headers.get("x-forwarded-proto") || "http"
    const baseUrl = `${proto}://${host}`
    // The per-order endpoint requires an admin session, so forward this request's cookies.
    const cookieHeader = req.headers.get("cookie") || ""

    const results: { success: BulkRow[]; failed: { row: BulkRow; error: string }[] } = { success: [], failed: [] }

    await Promise.all(
      rows.map(async (row) => {
        if (!row.orderId || !row.status) {
          results.failed.push({ row, error: "Missing orderId or status" })
          return
        }

        // Build payload to send to per-order update endpoint
        const body: any = { status: row.status }
        if (row.trackingNumber) body.trackingNumber = row.trackingNumber

        try {
          // Attempt to forward update to existing order endpoint
          const res = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(row.orderId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", cookie: cookieHeader },
            body: JSON.stringify(body),
          })

          if (!res.ok) {
            // capture error body if available
            let errMsg = `Status ${res.status}`
            try {
              const errJson = await res.json()
              errMsg = errJson?.message || JSON.stringify(errJson)
            } catch (e) {
              // ignore parse error
            }
            results.failed.push({ row, error: errMsg })
            return
          }

          results.success.push(row)
        } catch (err) {
          results.failed.push({ row, error: err instanceof Error ? err.message : "Unknown error" })
        }
      }),
    )

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}