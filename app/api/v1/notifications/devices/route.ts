/**
 * Device push-token registration for the mobile apps.
 *
 * POST   /api/v1/notifications/devices  — register or move a token
 * DELETE /api/v1/notifications/devices  — unregister on sign-out
 */

import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { registerDeviceToken, unregisterDeviceToken, type DevicePlatform } from "@/lib/push"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json().catch(() => null)
    const token = typeof body?.token === "string" ? body.token.trim() : ""
    const platform = body?.platform as DevicePlatform

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 })
    }
    if (platform !== "ios" && platform !== "android") {
      return NextResponse.json({ error: "platform must be 'ios' or 'android'" }, { status: 400 })
    }

    const registered = await registerDeviceToken(guard.user.id, token, platform, {
      deviceId: body?.deviceId,
      deviceName: body?.deviceName,
      appVersion: body?.appVersion,
    })
    if (!registered) {
      return NextResponse.json({ error: "Malformed push token" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v1/notifications/devices] register error", error)
    return NextResponse.json({ error: "Failed to register device" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json().catch(() => null)
    const token = typeof body?.token === "string" ? body.token.trim() : ""
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 })
    }
    await unregisterDeviceToken(token)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v1/notifications/devices] unregister error", error)
    return NextResponse.json({ error: "Failed to unregister device" }, { status: 500 })
  }
}
