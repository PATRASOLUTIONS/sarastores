import { NextResponse } from "next/server"
import { RecaptchaConfigurationError } from "@/lib/recaptcha-config"

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Request protection is temporarily unavailable. Please try again later.")
    this.name = "RateLimitUnavailableError"
  }
}

export function handleApiError(error: unknown, message?: string) {
  console.error("API Error:", error)

  if (error instanceof RateLimitUnavailableError || error instanceof RecaptchaConfigurationError) {
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 503, headers: { "Retry-After": "60" } },
    )
  }

  const errorMessage = message || (error instanceof Error ? error.message : "An unknown error occurred")

  return NextResponse.json(
    {
      error: errorMessage,
      success: false,
    },
    { status: 500 },
  )
}

export function ApiError() {
  return NextResponse.json(
    {
      error: "This endpoint is not meant to be called directly",
      success: false,
    },
    { status: 404 },
  )
}

export default function DefaultApiError() {
  return NextResponse.json(
    {
      error: "This endpoint is not meant to be called directly",
      success: false,
    },
    { status: 404 },
  )
}
