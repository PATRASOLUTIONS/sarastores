import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { StoreHeader } from "@/components/StoreHeader"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

export default function OrderConfirmedScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>()
  const { tokens, brand } = useTheme()
  const router = useRouter()

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />

      <View style={styles.container}>
        <View style={[styles.tick, { backgroundColor: tokens.success }]}>
          <Ionicons name="checkmark" size={38} color={brand.textInverse} />
        </View>

        <Text style={[styles.title, { color: tokens.textPrimary }]}>Thank you for your order</Text>
        <Text style={[styles.body, { color: tokens.textSecondary }]}>
          We&apos;ve emailed your confirmation and will notify you here as your order moves.
        </Text>

        {orderId ? (
          <View style={[styles.idBox, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <Text style={[styles.idLabel, { color: tokens.textTertiary }]}>Order number</Text>
            <Text style={[styles.idValue, { color: tokens.textPrimary }]}>{orderId}</Text>
          </View>
        ) : null}

        <Pressable style={[styles.primary, { backgroundColor: tokens.accent }]} onPress={() => router.replace("/orders")}>
          <Text style={[styles.primaryText, { color: brand.textInverse }]}>View My Orders</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace("/(tabs)")}>
          <Text style={[styles.secondaryText, { color: tokens.primary }]}>Continue shopping</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  tick: { width: 74, height: 74, borderRadius: 37, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  title: { fontSize: 21, fontWeight: "800", textAlign: "center" },
  body: { textAlign: "center", marginTop: spacing.md, lineHeight: 20, fontSize: 13 },
  idBox: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  idLabel: { fontSize: 11 },
  idValue: { fontSize: 16, fontWeight: "800", marginTop: 2 },
  primary: { marginTop: spacing.xxl, paddingVertical: 13, paddingHorizontal: spacing.xxl, borderRadius: 999 },
  primaryText: { fontWeight: "800", fontSize: 15 },
  secondary: { marginTop: spacing.md, paddingVertical: spacing.md },
  secondaryText: { fontWeight: "700", fontSize: 13.5 },
})
