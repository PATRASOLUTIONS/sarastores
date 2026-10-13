import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"

// Usage is committed with the order. Retired clients must not increment it twice.
export async function POST() {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  return NextResponse.json({
    success: false,
    error: "Coupon usage is recorded automatically when your order is placed. Update your client.",
  }, { status: 410 })
}
