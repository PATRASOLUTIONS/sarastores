import { Ionicons } from "@expo/vector-icons"
import { ReactNode } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { StoreHeader } from "@/components/StoreHeader"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

/** Card layout shared by every auth screen so recovery never looks like a different app. */
export function AuthShell({
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  const { tokens, brand } = useTheme()

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: tokens.primary }]}>
              <Ionicons name={icon} size={26} color={brand.textInverse} />
            </View>
            <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>{subtitle}</Text>
            {children}
          </View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

/** Inline success/error banner matching the website's green and red notice blocks. */
export function Notice({ kind, title, message }: { kind: "success" | "error"; title?: string; message: string }) {
  const { tokens } = useTheme()
  const ok = kind === "success"
  const fg = ok ? "#15803D" : "#B91C1C"

  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: ok ? "#F0FDF4" : "#FEF2F2", borderColor: ok ? "#BBF7D0" : "#FECACA" },
      ]}
    >
      <Ionicons
        name={ok ? "checkmark-circle" : "alert-circle"}
        size={18}
        color={fg}
        style={{ marginTop: 1 }}
      />
      <View style={styles.noticeBody}>
        {title ? <Text style={[styles.noticeTitle, { color: fg }]}>{title}</Text> : null}
        <Text style={[styles.noticeText, { color: ok ? "#166534" : "#991B1B" }]}>{message}</Text>
      </View>
      <View style={{ width: 0, backgroundColor: tokens.border }} />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  card: { padding: spacing.xl, borderRadius: 14, borderWidth: 1 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 13, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.xl, lineHeight: 19 },
  notice: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: 10, borderWidth: 1, marginBottom: spacing.lg },
  noticeBody: { flex: 1 },
  noticeTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  noticeText: { fontSize: 12.5, lineHeight: 18 },
})
