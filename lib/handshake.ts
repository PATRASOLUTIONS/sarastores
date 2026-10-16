/**
 * Partnership celebration schedule.
 *
 * The homepage stays behind a curtain until HANDSHAKE_LAUNCH_AT. At that
 * instant the curtain opens, the ribbon is cut, and the store is revealed.
 * Other pages are unchanged. Clear the variable to retire the ceremony.
 * URLs must be https; anything else falls back to the public brand sites.
 */

const DEFAULT_PARTNER_URL = "https://bytewiseconsulting.in"
const DEFAULT_STORE_URL = "https://sarastores.com"

export interface HandshakeLaunch {
  /** Canonical instant. The client waits until this moment, then celebrates. */
  launchAt: string
  partnerName: "Bytewise"
  partnerUrl: string
  storeName: "Sara Stores"
  storeUrl: string
}

function httpsOrigin(value: string | undefined, fallback: string): string {
  const candidate = (value || "").trim() || fallback
  try {
    const url = new URL(candidate)
    if (url.protocol !== "https:") return fallback
    return url.toString().replace(/\/$/, "")
  } catch {
    return fallback
  }
}

export function readHandshakeLaunch(
  env: Record<string, string | undefined> = process.env,
): HandshakeLaunch | null {
  const raw = env.HANDSHAKE_LAUNCH_AT?.trim()
  if (!raw) return null
  const time = Date.parse(raw)
  if (!Number.isFinite(time)) return null
  return {
    launchAt: new Date(time).toISOString(),
    partnerName: "Bytewise",
    partnerUrl: httpsOrigin(env.HANDSHAKE_PARTNER_URL, DEFAULT_PARTNER_URL),
    storeName: "Sara Stores",
    storeUrl: httpsOrigin(env.HANDSHAKE_STORE_URL, DEFAULT_STORE_URL),
  }
}

export function handshakeIsLive(launchAt: string, now: number): boolean {
  const time = Date.parse(launchAt)
  return Number.isFinite(time) && now >= time
}

export interface CountdownParts {
  live: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Remaining time until launch. `live` is true once `now` has reached the instant. */
export function countdownParts(launchAt: string, now: number): CountdownParts | null {
  const time = Date.parse(launchAt)
  if (!Number.isFinite(time) || !Number.isFinite(now)) return null
  const totalSeconds = Math.floor(Math.max(0, time - now) / 1000)
  return {
    live: now >= time,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  }
}
