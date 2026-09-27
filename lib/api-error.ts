import { NextResponse } from "next/server"

export function handleApiError(error: unknown, message?: string) {
  console.error("API Error:", error)

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
