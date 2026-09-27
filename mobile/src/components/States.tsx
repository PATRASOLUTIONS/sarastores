import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

/**
 * Shown where a screen needs an account. Without this an auth-gated screen
 * renders an empty body, which reads as a broken app rather than a prompt.
 */
export function SignInRequired({ title, message }: { title: string; message: string }) {
  const { tokens, brand } = useTheme()
  const router = useRouter()

  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: tokens.primarySubtle }]}>
        <Ionicons name="lock-closed-outline" size={26} color={tokens.primary} />
      </View>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: tokens.textSecondary }]}>{message}</Text>

      <Pressable style={[styles.primary, { backgroundColor: tokens.accent }]} onPress={() => router.push("/login")}>
        <Text style={[styles.primaryText, { color: brand.textInverse }]}>Sign in</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push("/register")}>
        <Text style={[styles.secondaryText, { color: tokens.primary }]}>Create an account</Text>
      </Pressable>
    </View>
  )
}

/** Neutral empty state for screens that loaded fine but have nothing to show. */
export function EmptyState({
  icon = "cube-outline",
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  const { tokens, brand } = useTheme()

  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: tokens.primarySubtle }]}>
        <Ionicons name={icon} size={26} color={tokens.primary} />
      </View>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: tokens.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable style={[styles.primary, { backgroundColor: tokens.accent }]} onPress={onAction}>
          <Text style={[styles.primaryText, { color: brand.textInverse }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  icon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "800", marginTop: spacing.lg },
  message: { fontSize: 13, textAlign: "center", marginTop: spacing.sm, lineHeight: 19 },
  primary: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryText: { fontWeight: "800", fontSize: 14 },
  secondary: { marginTop: spacing.md, paddingVertical: spacing.sm },
  secondaryText: { fontWeight: "700", fontSize: 13 },
})
