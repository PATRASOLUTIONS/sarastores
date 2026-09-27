import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { UnsubscribeSchema } from "@/lib/validation"
import { unsubscribeByToken } from "@/lib/customer-profile"

export const dynamic = "force-dynamic"

/**
 * Token-based unsubscribe. Deliberately unauthenticated: a one-click opt-out has to
 * work from an email client where the recipient has no session, and requiring login
 * to stop messages is both hostile and non-compliant.
 *
 * The response is identical for valid and invalid tokens so this cannot be used to
 * probe which tokens exist.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = UnsubscribeSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    await unsubscribeByToken(parsed.data.token, parsed.data.channel)

    return NextResponse.json({
      success: true,
      message: "Your preferences have been updated.",
    })
  } catch (error) {
    return handleApiError(error, "Failed to update preferences")
  }
}

/** One-click links in email clients are GETs. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = UnsubscribeSchema.safeParse({
      token: searchParams.get("token") ?? "",
      channel: searchParams.get("channel") ?? "all",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    await unsubscribeByToken(parsed.data.token, parsed.data.channel)

    return NextResponse.json({
      success: true,
      message: "Your preferences have been updated.",
    })
  } catch (error) {
    return handleApiError(error, "Failed to update preferences")
  }
}
