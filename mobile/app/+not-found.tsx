import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { StoreHeader } from "@/components/StoreHeader"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

/** Catches deep links to routes that no longer exist so they can't white-screen. */
export default function NotFoundScreen() {
  const { tokens, brand } = useTheme()
  const router = useRouter()

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <View style={styles.wrap}>
        <View style={[styles.icon, { backgroundColor: tokens.primarySubtle }]}>
          <Ionicons name="compass-outline" size={28} color={tokens.primary} />
        </View>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>Page not found</Text>
        <Text style={[styles.message, { color: tokens.textSecondary }]}>
          That link doesn&apos;t exist or has moved. Let&apos;s get you back to shopping.
        </Text>

        <Pressable style={[styles.primary, { backgroundColor: tokens.accent }]} onPress={() => router.replace("/")}>
          <Text style={[styles.primaryText, { color: brand.textInverse }]}>Go to home</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace("/(tabs)/search")}>
          <Text style={[styles.secondaryText, { color: tokens.primary }]}>Browse all products</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  icon: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", marginTop: spacing.lg },
  message: { fontSize: 13, textAlign: "center", marginTop: spacing.sm, lineHeight: 19 },
  primary: { marginTop: spacing.xl, paddingHorizontal: spacing.xxl, paddingVertical: 12, borderRadius: 999 },
  primaryText: { fontWeight: "800", fontSize: 14 },
  secondary: { marginTop: spacing.md, paddingVertical: spacing.sm },
  secondaryText: { fontWeight: "700", fontSize: 13 },
})
