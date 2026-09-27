import { api } from "@/api/client"
import type { AuthUser, TokenPair } from "@/api/types"
import { setAccessToken, setCachedUser, setRefreshToken, getRefreshToken } from "@/auth/token-store"
import * as Device from "expo-device"
import { Platform } from "react-native"

function deviceInfo() {
  return {
    deviceId: Device.osInternalBuildId ?? undefined,
    deviceName: Device.deviceName ?? undefined,
    platform: Platform.OS === "ios" ? "ios" : "android",
  }
}

async function persist(pair: TokenPair): Promise<AuthUser> {
  setAccessToken(pair.accessToken, pair.expiresIn)
  await setRefreshToken(pair.refreshToken)
  await setCachedUser(pair.user)
  return pair.user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const pair = await api.post<TokenPair>("/api/v1/auth/login", {
    email,
    password,
    device: deviceInfo(),
  })
  return persist(pair)
}

export async function loginWithGoogle(idToken: string): Promise<AuthUser> {
  const pair = await api.post<TokenPair>("/api/v1/auth/google", {
    idToken,
    device: deviceInfo(),
  })
  return persist(pair)
}

export async function signup(name: string, email: string, password: string): Promise<void> {
  await api.post("/api/auth/signup", { name, email, password })
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken()
  if (refreshToken) {
    // Best effort: the local tokens are cleared regardless, so a failed call
    // still signs the user out on this device.
    try {
      await api.post("/api/v1/auth/logout", { refreshToken })
    } catch {
      /* ignore */
    }
  }
}

export async function logoutEverywhere(): Promise<void> {
  try {
    await api.post("/api/v1/auth/logout", { allDevices: true }, { auth: true })
  } catch {
    /* ignore */
  }
}

/** Apple Guideline 5.1.1(v) requires this to be reachable from inside the app. */
export async function deleteAccount(password?: string): Promise<void> {
  await api.delete("/api/v1/account", { password }, { auth: true })
}

export async function fetchSession(): Promise<AuthUser | null> {
  const res = await api.get<{ user: AuthUser | null }>("/api/auth/session", { auth: true })
  return res.user
}
