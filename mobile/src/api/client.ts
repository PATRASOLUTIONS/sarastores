/**
 * HTTP client for the Sara Electronics API.
 *
 * Handles bearer auth and token refresh. The important property is that a
 * refresh is single-flight: when several requests discover an expired token at
 * once they all await the same refresh instead of each spending one. That
 * matters because the server rotates refresh tokens and treats a replayed one
 * as theft — parallel refreshes would revoke the whole family and sign the user
 * out.
 */

import Constants from "expo-constants"
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpired,
  setAccessToken,
  setCachedUser,
  setRefreshToken,
} from "@/auth/token-store"
import type { TokenPair } from "@/api/types"

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ||
  "http://localhost:3005"

const DEFAULT_TIMEOUT_MS = 20000

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

type SignOutListener = () => void
const signOutListeners = new Set<SignOutListener>()

/** Fires when the refresh token is rejected and the user must sign in again. */
export function onForcedSignOut(listener: SignOutListener): () => void {
  signOutListeners.add(listener)
  return () => signOutListeners.delete(listener)
}

async function forceSignOut(): Promise<void> {
  await clearTokens()
  signOutListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      /* a listener must not break sign-out */
    }
  })
}

let refreshInFlight: Promise<boolean> | null = null

async function performRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      await forceSignOut()
      return false
    }
    const pair = (await res.json()) as TokenPair
    setAccessToken(pair.accessToken, pair.expiresIn)
    await setRefreshToken(pair.refreshToken)
    await setCachedUser(pair.user)
    return true
  } catch {
    // A network blip is not proof the token is bad, so don't sign the user out.
    return false
  }
}

async function ensureFreshToken(): Promise<void> {
  if (!isAccessTokenExpired()) return
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  await refreshInFlight
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  /** Attach the bearer token. Off for public catalogue reads. */
  auth?: boolean
  timeoutMs?: number
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  if (auth) await ensureFreshToken()

  const send = async (): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(auth && getAccessToken() ? { authorization: `Bearer ${getAccessToken()}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal ?? controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  let res = await send()

  // A 401 on an authenticated call means the token died earlier than expected
  // (rotated secret, revoked session). One refresh, one retry, then give up.
  if (res.status === 401 && auth) {
    const refreshed = await (refreshInFlight ?? (refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })))
    if (refreshed) {
      res = await send()
    } else {
      await forceSignOut()
    }
  }

  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    const message =
      (parsed as { error?: string; message?: string })?.error ||
      (parsed as { message?: string })?.message ||
      `Request failed (${res.status})`
    throw new ApiError(message, res.status, parsed)
  }

  return parsed as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE", body }),
}

export { BASE_URL }
