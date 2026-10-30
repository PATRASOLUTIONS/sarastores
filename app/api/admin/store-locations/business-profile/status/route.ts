import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { BUSINESS_CONNECTIONS, businessProfileConfig, BusinessProfileError, disconnectBusinessConnection, type BusinessProfileConnection } from "@/lib/google-business-profile-auth"
import { GoogleBusinessConnectionId } from "@/lib/google-business-profile-types"

export const maxDuration = 45

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const config = businessProfileConfig()
    const connections = await (await getCollection<BusinessProfileConnection>(BUSINESS_CONNECTIONS)).find({ ownerId: guard.userId }, {
      projection: { email: 1, name: 1, status: 1, createdAt: 1 },
    }).sort({ createdAt: -1 }).toArray()
    return NextResponse.json({ success: true, configured: config.configured, missing: config.missing, redirectUri: config.redirectUri,
      connections: connections.map(connection => ({ id: String(connection._id), email: connection.email, name: connection.name,
        status: connection.status, connectedAt: connection.createdAt.toISOString() })) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch { return NextResponse.json({ error: "Unable to load Google Business Profile connection status." }, { status: 503 }) }
}
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const parsed = z.object({ connectionId: GoogleBusinessConnectionId }).strict().safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Select a valid Google connection." }, { status: 400 })
  try {
    await disconnectBusinessConnection(guard.userId, parsed.data.connectionId)
    return NextResponse.json({ success: true })
  } catch (error) { return NextResponse.json({ error: error instanceof BusinessProfileError ? error.message : "Could not disconnect the Google account." }, { status: error instanceof BusinessProfileError ? error.status : 503 }) }
}
