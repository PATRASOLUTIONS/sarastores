import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { fetchOrders } from "@/api/catalog"
import { EmptyState, SignInRequired } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

export default function OrdersScreen() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { tokens, brand } = useTheme()
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    enabled: isAuthenticated,
  })

  const statusColour = (status: string) => {
    const s = status?.toLowerCase()
    if (s === "delivered" || s === "completed") return tokens.success
    if (s === "cancelled") return brand.danger
    if (s === "shipped" || s === "confirmed") return tokens.primary
    return tokens.textSecondary
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <Text style={[styles.pageTitle, { color: tokens.textPrimary }]}>My Orders</Text>

      {authLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : !isAuthenticated ? (
        <SignInRequired title="Sign in to see your orders" message="Your order history and tracking live here." />
      ) : isLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : isError ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load your orders" message="Please try again in a moment." />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(order) => order.id ?? order.orderId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id ?? item.orderId } })}
            >
              <View style={styles.row}>
                <Text style={[styles.orderId, { color: tokens.textPrimary }]}>{item.orderId}</Text>
                <Text style={[styles.status, { color: statusColour(item.status) }]}>{item.status}</Text>
              </View>
              <Text style={[styles.meta, { color: tokens.textTertiary }]}>
                {item.items?.length ?? 0} item{(item.items?.length ?? 0) === 1 ? "" : "s"} ·{" "}
                {new Date(item.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
              <View style={styles.row}>
                <Text style={[styles.total, { color: tokens.textPrimary }]}>{formatInr(item.total)}</Text>
                <View style={styles.viewRow}>
                  <Text style={[styles.view, { color: tokens.primary }]}>View details</Text>
                  <Ionicons name="chevron-forward" size={13} color={tokens.primary} />
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No orders yet"
              message="When you place an order it will appear here."
            />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 19, fontWeight: "800", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  spinner: { marginTop: spacing.xxl },
  card: { padding: spacing.lg, borderRadius: 12, borderWidth: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontWeight: "800", fontSize: 13.5 },
  status: { fontWeight: "800", fontSize: 11.5, textTransform: "capitalize" },
  meta: { fontSize: 11.5, marginTop: spacing.xs },
  total: { fontSize: 17, fontWeight: "800", marginTop: spacing.sm },
  viewRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: spacing.sm },
  view: { fontSize: 12, fontWeight: "700" },
})
