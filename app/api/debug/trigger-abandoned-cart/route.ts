import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { DebugCartRecoverySchema } from "@/lib/validation"
import { runCartRecovery } from "@/lib/retention/cart-recovery"

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = DebugCartRecoverySchema.safeParse(request.body === null ? {} : await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const result = await runCartRecovery(parsed.data)
    return NextResponse.json({ success: result.failed === 0, ...result }, { status: result.failed ? 207 : 200 })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    console.error("[Debug Cart Recovery] Run failed", error)
    return NextResponse.json({ error: "Failed to run cart recovery" }, { status: 500 })
  }
}
