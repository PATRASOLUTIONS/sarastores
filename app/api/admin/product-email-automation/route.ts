import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { EmailConfigurationError } from "@/lib/smtp"
import { getProductEmailAutomation, productEmailSettingsSchema, saveProductEmailAutomation, runProductEmailAutomation } from "@/lib/product-email-automation"

export const dynamic = "force-dynamic"
export const maxDuration = 300
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } })

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try { return json(await getProductEmailAutomation()) }
  catch (error) { return handleApiError(error, "Could not load daily product email settings") }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = productEmailSettingsSchema.safeParse(await request.json())
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Invalid email settings" }, 400)
    await saveProductEmailAutomation(guard.userId, parsed.data)
    return json({ success: true })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof EmailConfigurationError) return json({ error: error.message }, 400)
    return handleApiError(error, "Could not save daily product email settings")
  }
}

export async function POST() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const result = await runProductEmailAutomation({ manual: true, actor: guard.userId })
    return json(result, ("unknown" in result && (result.unknown || result.failed)) ? 207 : 200)
  } catch (error) {
    if (error instanceof EmailConfigurationError) return json({ error: error.message }, 400)
    return handleApiError(error, "Could not send the daily product email")
  }
}
