import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider } from "@/auth/context"
import { CartProvider } from "@/cart/context"
import { ThemeProvider, useTheme } from "@/theme/ThemeContext"

/**
 * Expo Router renders this instead of a white screen when a route throws.
 * Deliberately uses no providers or theme — those may be what failed.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={fallback.wrap}>
      <Text style={fallback.title}>Something went wrong</Text>
      <Text style={fallback.message}>
        We hit an unexpected problem. Try again — your cart and account are safe.
      </Text>
      <Text style={fallback.detail} numberOfLines={3}>
        {error.message}
      </Text>
      <Pressable style={fallback.button} onPress={() => void retry()}>
        <Text style={fallback.buttonText}>Try again</Text>
      </Pressable>
    </View>
  )
}

const fallback = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#FFFFFF" },
  title: { fontSize: 18, fontWeight: "800", color: "#0F2557" },
  message: { fontSize: 13, color: "#475569", textAlign: "center", marginTop: 8, lineHeight: 19 },
  detail: { fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 12 },
  button: { marginTop: 24, backgroundColor: "#FF6A2C", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 999 },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
})

function ThemedStack() {
  const { tokens } = useTheme()

  return (
    <>
      <StatusBar style="dark" />
      {/* Every screen renders its own StoreHeader, so the native header would double up. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.surface } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
        <Stack.Screen name="register" options={{ presentation: "modal" }} />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="product/[slug]" />
        <Stack.Screen name="category/[id]" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="track" />
        <Stack.Screen name="wishlist" />
        <Stack.Screen name="account/profile" />
        <Stack.Screen name="account/preferences" />
        <Stack.Screen name="offers" />
        <Stack.Screen name="brands" />
        <Stack.Screen name="brands/[slug]" />
        <Stack.Screen name="compare" />
        <Stack.Screen name="store-locator" />
        <Stack.Screen name="menu" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="order-confirmed" options={{ gestureEnabled: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  // Created in state so Fast Refresh doesn't discard the cache on every edit.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <ThemedStack />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
