/**
 * Token storage.
 *
 * The refresh token is a long-lived credential and goes in the Keychain /
 * Android Keystore via expo-secure-store. The access token is deliberately kept
 * in memory only: it lives an hour, and writing it to disk on every refresh
 * would put a bearer credential in storage for no benefit.
 */

import * as SecureStore from "expo-secure-store"
import type { AuthUser } from "@/api/types"

const REFRESH_TOKEN_KEY = "sara.refreshToken"
const USER_KEY = "sara.user"

let accessToken: string | null = null
let accessTokenExpiresAt = 0

export function getAccessToken(): string | null {
  return accessToken
}

/** True shortly before real expiry, so we refresh before a request can fail. */
export function isAccessTokenExpired(skewSeconds = 60): boolean {
  if (!accessToken) return true
  return Date.now() >= accessTokenExpiresAt - skewSeconds * 1000
}

export function setAccessToken(token: string | null, expiresInSeconds = 0): void {
  accessToken = token
  accessTokenExpiresAt = token ? Date.now() + expiresInSeconds * 1000 : 0
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token)
    else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
  } catch {
    // A device with no secure hardware still has to be usable; the user just
    // signs in again next launch.
  }
}

/** Cached so the UI can render a signed-in shell before the first refresh returns. */
export async function getCachedUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export async function setCachedUser(user: AuthUser | null): Promise<void> {
  try {
    if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
    else await SecureStore.deleteItemAsync(USER_KEY)
  } catch {
    /* non-fatal */
  }
}

export async function clearTokens(): Promise<void> {
  setAccessToken(null)
  await setRefreshToken(null)
  await setCachedUser(null)
}
