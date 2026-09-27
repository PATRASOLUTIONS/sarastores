/**
 * Push notifications for the mobile apps.
 *
 * Delivery goes through Expo's push service, which fronts both APNs and FCM,
 * so there are no per-platform credentials to manage here — the certificates
 * live in the EAS project.
 *
 * Sending is always best-effort: a failed notification must never fail the
 * business operation that triggered it (an order still succeeds even if the
 * confirmation push does not arrive).
 */

import { getCollection } from "@/lib/db-service"

export const DEVICE_TOKENS_COLLECTION = "device_tokens"

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"
/** Expo rejects batches larger than this. */
const MAX_BATCH = 100

export type DevicePlatform = "ios" | "android"

export interface DeviceTokenRecord {
  userId: string
  token: string
  platform: DevicePlatform
  deviceId?: string
  deviceName?: string
  appVersion?: string
  createdAt: Date
  updatedAt: Date
}

export interface PushMessage {
  title: string
  body: string
  data?: Record<string, unknown>
  badge?: number
}

function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token) || /^[A-Za-z0-9_-]{20,}$/.test(token)
}

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: DevicePlatform,
  meta: { deviceId?: string; deviceName?: string; appVersion?: string } = {},
): Promise<boolean> {
  if (!isExpoPushToken(token)) return false
  const collection = await getCollection(DEVICE_TOKENS_COLLECTION)
  const now = new Date()
  // Keyed on the token, not the user: reinstalling or switching accounts on the
  // same handset must move the token rather than leave it pointing at the old
  // account, which would send that user's order updates to someone else.
  await collection.updateOne(
    { token },
    {
      $set: {
        userId,
        platform,
        deviceId: meta.deviceId?.slice(0, 128),
        deviceName: meta.deviceName?.slice(0, 128),
        appVersion: meta.appVersion?.slice(0, 32),
        updatedAt: now,
      },
      $setOnInsert: { token, createdAt: now },
    },
    { upsert: true },
  )
  return true
}

export async function unregisterDeviceToken(token: string): Promise<boolean> {
  const collection = await getCollection(DEVICE_TOKENS_COLLECTION)
  const result = await collection.deleteOne({ token })
  return result.deletedCount > 0
}

export async function getUserDeviceTokens(userId: string): Promise<string[]> {
  const collection = await getCollection(DEVICE_TOKENS_COLLECTION)
  const docs = await collection.find({ userId }, { projection: { token: 1 } }).toArray()
  return docs.map((d) => d.token as string).filter(Boolean)
}

/** Drop tokens Expo reports as dead so we stop paying to retry them. */
async function pruneTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return
  try {
    const collection = await getCollection(DEVICE_TOKENS_COLLECTION)
    await collection.deleteMany({ token: { $in: tokens } })
  } catch (error) {
    console.warn("[push] failed to prune dead tokens", error)
  }
}

export async function sendPushToTokens(tokens: string[], message: PushMessage): Promise<number> {
  const unique = [...new Set(tokens.filter(Boolean))]
  if (unique.length === 0) return 0

  let delivered = 0
  const dead: string[] = []

  for (let i = 0; i < unique.length; i += MAX_BATCH) {
    const batch = unique.slice(i, i + MAX_BATCH)
    const payload = batch.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: "default",
      ...(typeof message.badge === "number" ? { badge: message.badge } : {}),
    }))

    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        console.warn("[push] Expo rejected batch", { status: res.status })
        continue
      }
      const json = await res.json()
      const tickets = Array.isArray(json?.data) ? json.data : []
      tickets.forEach((ticket: any, index: number) => {
        if (ticket?.status === "ok") {
          delivered++
        } else if (ticket?.details?.error === "DeviceNotRegistered") {
          dead.push(batch[index])
        }
      })
    } catch (error) {
      console.warn("[push] send failed", error)
    }
  }

  await pruneTokens(dead)
  return delivered
}

export async function sendPushToUser(userId: string, message: PushMessage): Promise<number> {
  try {
    const tokens = await getUserDeviceTokens(userId)
    return await sendPushToTokens(tokens, message)
  } catch (error) {
    console.warn("[push] sendPushToUser failed", error)
    return 0
  }
}

const ORDER_STATUS_COPY: Record<string, { title: string; body: (orderId: string) => string }> = {
  confirmed: { title: "Order confirmed", body: (id) => `We've confirmed order ${id}. We'll let you know when it ships.` },
  processing: { title: "Order being prepared", body: (id) => `Order ${id} is being prepared for dispatch.` },
  shipped: { title: "Order shipped", body: (id) => `Order ${id} is on its way.` },
  delivered: { title: "Order delivered", body: (id) => `Order ${id} has been delivered. Enjoy!` },
  cancelled: { title: "Order cancelled", body: (id) => `Order ${id} has been cancelled.` },
}

/** Fire-and-forget order status push. Safe to call without awaiting. */
export async function notifyOrderStatus(userId: string, orderId: string, status: string): Promise<void> {
  const copy = ORDER_STATUS_COPY[String(status).toLowerCase()]
  if (!copy || !userId) return
  await sendPushToUser(userId, {
    title: copy.title,
    body: copy.body(orderId),
    data: { type: "order_status", orderId, status },
  })
}
