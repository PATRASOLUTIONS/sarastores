/**
 * Refresh tokens for native clients.
 *
 * The web app authenticates with an httpOnly cookie that the browser refreshes
 * implicitly on every navigation. A mobile app has no such mechanism, and the
 * 24 h access token would log users out daily, so native clients exchange a
 * long-lived refresh token for new access tokens.
 *
 * Node-only: uses `crypto` and MongoDB. Never import this from middleware or
 * from `lib/session.ts`, both of which must stay Edge-safe.
 *
 * Tokens are opaque random strings; only their SHA-256 hash is stored, so a
 * database leak does not yield usable credentials. Every refresh rotates the
 * token. Presenting an already-rotated token is treated as theft and revokes
 * the whole family — the legitimate device is forced to re-authenticate rather
 * than silently sharing a session with an attacker.
 */

import crypto from "crypto"
import { getCollection } from "@/lib/db-service"

export const REFRESH_TOKENS_COLLECTION = "refresh_tokens"

/** Short, so a leaked access token is only briefly useful. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
/** Long, so an app opened once a month stays signed in. */
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 60

export type DevicePlatform = "ios" | "android" | "web"

export interface DeviceInfo {
  deviceId?: string
  deviceName?: string
  platform?: DevicePlatform
}

export interface RefreshTokenRecord {
  tokenHash: string
  familyId: string
  userId: string
  deviceId?: string
  deviceName?: string
  platform?: DevicePlatform
  createdAt: Date
  expiresAt: Date
  lastUsedAt?: Date
  rotatedAt?: Date
  revokedAt?: Date
  revokedReason?: string
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

function newOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url")
}

function sanitizeDevice(device: DeviceInfo = {}): DeviceInfo {
  const platform =
    device.platform === "ios" || device.platform === "android" || device.platform === "web"
      ? device.platform
      : undefined
  return {
    deviceId: device.deviceId ? String(device.deviceId).slice(0, 128) : undefined,
    deviceName: device.deviceName ? String(device.deviceName).slice(0, 128) : undefined,
    platform,
  }
}

export async function issueRefreshToken(
  userId: string,
  device: DeviceInfo = {},
  familyId?: string,
): Promise<{ token: string; expiresAt: Date; familyId: string }> {
  const collection = await getCollection(REFRESH_TOKENS_COLLECTION)
  const token = newOpaqueToken()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)
  const resolvedFamily = familyId || crypto.randomUUID()

  const record: RefreshTokenRecord = {
    tokenHash: hashToken(token),
    familyId: resolvedFamily,
    userId,
    ...sanitizeDevice(device),
    createdAt: new Date(),
    expiresAt,
  }
  await collection.insertOne(record)
  return { token, expiresAt, familyId: resolvedFamily }
}

export type RotateResult =
  | { ok: true; userId: string; token: string; expiresAt: Date; familyId: string }
  | { ok: false; reason: "not_found" | "expired" | "revoked" | "reused" }

/**
 * Exchange a refresh token for a fresh pair. The presented token is retired in
 * the same call, so it can only ever be used once.
 */
export async function rotateRefreshToken(
  rawToken: string,
  device: DeviceInfo = {},
): Promise<RotateResult> {
  const collection = await getCollection(REFRESH_TOKENS_COLLECTION)
  const record = (await collection.findOne({ tokenHash: hashToken(rawToken) })) as RefreshTokenRecord | null

  if (!record) return { ok: false, reason: "not_found" }

  if (record.rotatedAt) {
    // This token was already exchanged. Either the client replayed it or it was
    // stolen; we cannot tell which, so we invalidate every token in the family.
    await revokeFamily(record.familyId, "refresh_token_reuse_detected")
    console.warn("[auth] refresh token reuse detected", {
      userId: record.userId,
      familyId: record.familyId,
    })
    return { ok: false, reason: "reused" }
  }
  if (record.revokedAt) return { ok: false, reason: "revoked" }
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" }

  const next = await issueRefreshToken(
    record.userId,
    {
      deviceId: device.deviceId ?? record.deviceId,
      deviceName: device.deviceName ?? record.deviceName,
      platform: device.platform ?? record.platform,
    },
    record.familyId,
  )

  await collection.updateOne(
    { tokenHash: record.tokenHash },
    { $set: { rotatedAt: new Date(), lastUsedAt: new Date() } },
  )

  return { ok: true, userId: record.userId, token: next.token, expiresAt: next.expiresAt, familyId: record.familyId }
}

export async function revokeRefreshToken(rawToken: string, reason = "logout"): Promise<boolean> {
  const collection = await getCollection(REFRESH_TOKENS_COLLECTION)
  const result = await collection.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  )
  return result.modifiedCount > 0
}

export async function revokeFamily(familyId: string, reason: string): Promise<number> {
  const collection = await getCollection(REFRESH_TOKENS_COLLECTION)
  const result = await collection.updateMany(
    { familyId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  )
  return result.modifiedCount
}

/** Used by logout-everywhere, password reset and account deletion. */
export async function revokeAllForUser(userId: string, reason: string): Promise<number> {
  const collection = await getCollection(REFRESH_TOKENS_COLLECTION)
  const result = await collection.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  )
  return result.modifiedCount
}
