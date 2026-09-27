/**
 * Push registration.
 *
 * The token is registered against the signed-in account on the server, so it
 * must be re-registered on every sign-in and removed on sign-out — otherwise a
 * shared handset delivers one user's order updates to another.
 */

import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import { Platform } from "react-native"
import { api } from "@/api/client"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

let lastRegisteredToken: string | null = null

export async function registerForPushNotifications(): Promise<string | null> {
  // The simulator has no push token; bailing early keeps dev logs clean.
  if (!Device.isDevice) return null

  try {
    const existing = await Notifications.getPermissionsAsync()
    let status = existing.status
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync()
      status = requested.status
    }
    if (status !== "granted") return null

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders", {
        name: "Order updates",
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: "#FF6A2C",
      })
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    if (!token) return null

    await api.post(
      "/api/v1/notifications/devices",
      {
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        deviceName: Device.deviceName ?? undefined,
        appVersion: Constants.expoConfig?.version ?? undefined,
      },
      { auth: true },
    )
    lastRegisteredToken = token
    return token
  } catch (error) {
    // Notifications are a nice-to-have; never block sign-in on them.
    console.warn("[push] registration failed", error)
    return null
  }
}

export async function unregisterPushToken(): Promise<void> {
  if (!lastRegisteredToken) return
  try {
    await api.delete("/api/v1/notifications/devices", { token: lastRegisteredToken }, { auth: true })
  } catch {
    /* ignore */
  } finally {
    lastRegisteredToken = null
  }
}
