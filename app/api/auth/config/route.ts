import { NextResponse } from "next/server"
import { getRecaptchaConfiguration } from "@/lib/recaptcha-config"
import { handleApiError } from "@/lib/api-error"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json({
      googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      recaptcha: getRecaptchaConfiguration(),
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleApiError(error)
  }
}
