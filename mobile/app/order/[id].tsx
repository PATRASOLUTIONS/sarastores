import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { EmptyState, SignInRequired } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { api } from "@/api/client"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

interface OrderItem {
  name: string
  quantity: number
  price: number
  productId?: string
}

interface OrderDetail {
  id: string
  orderId?: string | null
  status: string
  date?: string
  createdAt?: string
  total: number
  subtotal?: number
  tax?: number
  shipping?: number
  coupon?: { code: string; discount: number } | null
  paymentMethod?: string
  items?: OrderItem[]
  shippingAddress?: {
    name?: string
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  fulfilment?: { method?: string; storeName?: string; storeAddress?: string }
  trackingNumber?: string | null
}

const STATUS_COLOR: Record<string, string> = {
  delivered: "#059669",
  completed: "#059669",
  cancelled: "#DC2626",
  returned: "#DC2626",
  shipped: "#7C3AED",
  in_transit: "#D97706",
  out_for_delivery: "#EA580C",
  confirmed: "#2563EB",
  processing: "#4F46E5",
  packed: "#4F46E5",
  pending: "#6B7280",
}

export default function OrderDetailScreen() {
  const { tokens, brand } = useTheme()
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const params = useLocalSearchParams<{ id?: string; token?: string }>()
  const id = typeof params.id === "string" ? params.id : ""
  const token = typeof params.token === "string" ? params.token : undefined

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order", id, token],
    queryFn: () =>
      api.get<OrderDetail>(`/api/orders/${encodeURIComponent(id)}${token ? `?token=${encodeURIComponent(token)}` : ""}`, {
        auth: true,
      }),
    enabled: Boolean(id) && (isAuthenticated || Boolean(token)),
  })

  const statusColour = STATUS_COLOR[data?.status?.toLowerCase() ?? ""] ?? tokens.textSecondary
  const placed = data?.date ?? data?.createdAt
  const pickup = data?.fulfilment?.method === "pickup"
  const addr = data?.shippingAddress
  const addressLine = [addr?.name, addr?.street, addr?.city, addr?.state, addr?.zip].filter(Boolean).join(", ")

  const body = () => {
    if (authLoading) return <ActivityIndicator style={styles.spinner} color={tokens.primary} />
    if (!isAuthenticated && !token) {
      return (
        <SignInRequired
          title="Sign in to view this order"
          message="We couldn't confirm this order belongs to you. Sign in, or track it without an account."
        />
      )
    }
    if (isLoading) return <ActivityIndicator style={styles.spinner} color={tokens.primary} />
    if (isError || !data) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="Order not found"
          message="We couldn't find that order. Check the link, or sign in if you placed it with an account."
          actionLabel="Track an order"
          onAction={() => router.push("/track")}
        />
      )
    }

    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
          <View style={styles.headRow}>
            <View style={[styles.tick, { backgroundColor: `${statusColour}1A` }]}>
              <Ionicons name="checkmark-circle" size={22} color={statusColour} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.orderId, { color: tokens.textPrimary }]}>
                Order {data.orderId ?? data.id}
              </Text>
              <Text style={[styles.sub, { color: tokens.textSecondary }]}>
                <Text style={{ color: statusColour, fontWeight: "700" }}>{data.status}</Text>
                {placed ? ` · Placed ${new Date(placed).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { color: tokens.textSecondary }]}>Total</Text>
            <Text style={[styles.vStrong, { color: tokens.textPrimary }]}>{formatInr(data.total)}</Text>
          </View>
          {data.paymentMethod ? (
            <View style={styles.kvRow}>
              <Text style={[styles.k, { color: tokens.textSecondary }]}>Payment</Text>
              <Text style={[styles.v, { color: tokens.textPrimary }]}>
                {data.paymentMethod.charAt(0).toUpperCase() + data.paymentMethod.slice(1)}
              </Text>
            </View>
          ) : null}
          {data.trackingNumber ? (
            <View style={styles.kvRow}>
              <Text style={[styles.k, { color: tokens.textSecondary }]}>Tracking</Text>
              <Text style={[styles.v, { color: tokens.textPrimary }]}>{data.trackingNumber}</Text>
            </View>
          ) : null}
          <View style={[styles.divider, { backgroundColor: tokens.border }]} />
          <Text style={[styles.k, { color: tokens.textSecondary }]}>
            {pickup ? "Collect from" : "Delivering to"}
          </Text>
          <Text style={[styles.address, { color: tokens.textPrimary }]}>
            {pickup
              ? [data.fulfilment?.storeName, data.fulfilment?.storeAddress].filter(Boolean).join(", ") || "Store pickup"
              : addressLine || "—"}
          </Text>
        </View>

        {data.items?.length ? (
          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <View style={styles.sectionHead}>
              <Ionicons name="cube-outline" size={16} color={tokens.primary} />
              <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Items</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={`${item.name}-${i}`} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: tokens.textPrimary }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemQty, { color: tokens.textTertiary }]}>Qty {item.quantity}</Text>
                </View>
                <Text style={[styles.itemPrice, { color: tokens.textPrimary }]}>
                  {formatInr(item.price * item.quantity)}
                </Text>
              </View>
            ))}

            {data.subtotal !== undefined ? (
              <>
                <View style={[styles.divider, { backgroundColor: tokens.border }]} />
                <View style={styles.kvRow}>
                  <Text style={[styles.k, { color: tokens.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.v, { color: tokens.textPrimary }]}>{formatInr(data.subtotal)}</Text>
                </View>
                {data.coupon ? (
                  <View style={styles.kvRow}>
                    <Text style={[styles.k, { color: tokens.textSecondary }]}>Coupon ({data.coupon.code})</Text>
                    <Text style={[styles.v, { color: tokens.success }]}>−{formatInr(data.coupon.discount)}</Text>
                  </View>
                ) : null}
                {data.shipping !== undefined ? (
                  <View style={styles.kvRow}>
                    <Text style={[styles.k, { color: tokens.textSecondary }]}>Shipping</Text>
                    <Text style={[styles.v, { color: tokens.textPrimary }]}>
                      {data.shipping === 0 ? "FREE" : formatInr(data.shipping)}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[styles.secondaryBtn, { borderColor: tokens.primary }]}
          onPress={() => router.push({ pathname: "/track", params: { orderId: data.orderId ?? data.id } })}
        >
          <Ionicons name="car-outline" size={17} color={tokens.primary} />
          <Text style={[styles.secondaryText, { color: tokens.primary }]}>Track this order</Text>
        </Pressable>

        <Pressable style={[styles.primaryBtn, { backgroundColor: tokens.accent }]} onPress={() => router.replace("/")}>
          <Text style={[styles.primaryText, { color: brand.textInverse }]}>Continue shopping</Text>
        </Pressable>
      </ScrollView>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      {body()}
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  spinner: { marginTop: spacing.xxl },
  card: { borderRadius: 12, borderWidth: 1, padding: spacing.lg },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  tick: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  orderId: { fontSize: 16, fontWeight: "800" },
  sub: { fontSize: 12.5, marginTop: 3 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  k: { fontSize: 12.5 },
  v: { fontSize: 13, fontWeight: "600" },
  vStrong: { fontSize: 16, fontWeight: "800" },
  divider: { height: 1, marginVertical: spacing.md },
  address: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: "800" },
  item: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm },
  itemName: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  itemQty: { fontSize: 11.5, marginTop: 2 },
  itemPrice: { fontSize: 13.5, fontWeight: "700" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  secondaryText: { fontWeight: "800", fontSize: 14 },
  primaryBtn: { paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  primaryText: { fontWeight: "800", fontSize: 15 },
})
