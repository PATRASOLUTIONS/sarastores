import { createHash } from "node:crypto"
import { getCollection } from "@/lib/db-service"

export const REVOKED_SESSIONS_COLLECTION = "revoked_sessions"

interface RevokedSession {
  _id: string
  expiresAt: Date
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Store only a digest, and retain it until the signed token expires. */
export async function revokeSessionToken(token: string, expiresAt: number): Promise<void> {
  const collection = await getCollection<RevokedSession>(REVOKED_SESSIONS_COLLECTION)
  const result = await collection.updateOne(
    { _id: tokenHash(token) },
    { $setOnInsert: { expiresAt: new Date(expiresAt * 1000) } },
    { upsert: true },
  )
  if (!result.acknowledged) throw new Error("Session revocation could not be saved")
}

export async function isSessionRevoked(token: string): Promise<boolean> {
  const collection = await getCollection<RevokedSession>(REVOKED_SESSIONS_COLLECTION)
  const revoked = await collection.findOne(
    { _id: tokenHash(token), expiresAt: { $gt: new Date() } },
    { projection: { _id: 1 } },
  )
  return revoked !== null
}
