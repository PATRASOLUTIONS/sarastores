import { NextResponse } from "next/server"
import { paymentConfiguration } from "@/lib/payment-config"
import { handleApiError } from "@/lib/api-error"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(paymentConfiguration(), { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    return handleApiError(error, "Payment gateway configuration is unavailable")
  }
}
