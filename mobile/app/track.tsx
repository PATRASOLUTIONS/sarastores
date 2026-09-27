import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { EmptyState } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { BASE_URL } from "@/api/client"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

// Mirrors STATUS_STEPS in app/track/page.tsx.
const STEPS = [
  { key: "ordered", label: "Order Placed", icon: "cube-outline", color: "#2563EB" },
  { key: "processing", label: "Processing", icon: "business-outline", color: "#4F46E5" },
  { key: "shipped", label: "Shipped", icon: "bag-handle-outline", color: "#7C3AED" },
  { key: "transit", label: "In Transit", icon: "car-outline", color: "#D97706" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "location-outline", color: "#EA580C" },
  { key: "delivered", label: "Delivered", icon: "home-outline", color: "#059669" },
] as const

interface TrackEvent {
  status: string
  location?: string
  timestamp?: string
  description?: string
}

interface Tracking {
  orderId: string
  trackingNumber?: string
  carrier?: string
  currentStatus: string
  estimatedDelivery?: string
  origin?: string
  destination?: string
  events?: TrackEvent[]
}

export default function TrackScreen() {
  const { tokens, brand } = useTheme()
  const params = useLocalSearchParams<{ orderId?: string }>()

  const [query, setQuery] = useState(typeof params.orderId === "string" ? params.orderId : "")
  const [busy, setBusy] = useState(false)
  const [tracking, setTracking] = useState<Tracking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const track = async (raw?: string) => {
    const term = (raw ?? query).trim()
    if (!term) return
    setBusy(true)
    setError(null)
    setHint(null)
    setTracking(null)
    try {
      // Public endpoint — deliberately not using the authed client so guests can track.
      const res = await fetch(`${BASE_URL}/api/orders/track?orderId=${encodeURIComponent(term)}`)
      const data = await res.json()
      if (!res.ok || !data?.tracking) {
        setError(data?.error ?? "Order not found. Please check your order ID and try again.")
        setHint(data?.hint ?? null)
        return
      }
      setTracking(data.tracking as Tracking)
    } catch {
      setError("We couldn't reach the tracking service. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  // Deep links and the order screen both arrive with ?orderId= already set.
  useEffect(() => {
    if (typeof params.orderId === "string" && params.orderId) void track(params.orderId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orderId])

  const activeIndex = tracking ? STEPS.findIndex((s) => s.key === tracking.currentStatus) : -1

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: tokens.primary }]}>
          <View style={styles.badge}>
            <View style={styles.dot} />
            <Text style={styles.badgeText}>Live Tracking</Text>
          </View>
          <Text style={styles.heroTitle}>Track Your Order</Text>
          <Text style={styles.heroSub}>
            Enter your order ID to see real-time shipment status with live tracking.
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Enter Order ID, Payment ID, or Tracking Number"
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => void track()}
              style={styles.searchInput}
            />
            <Pressable
              style={[styles.trackBtn, { backgroundColor: tokens.accent }, !query.trim() && styles.disabled]}
              onPress={() => void track()}
              disabled={busy || !query.trim()}
            >
              {busy ? (
                <ActivityIndicator color={brand.textInverse} size="small" />
              ) : (
                <Text style={[styles.trackBtnText, { color: brand.textInverse }]}>Track</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.heroHelp}>
            Enter your order ID from the confirmation email (with or without #), Razorpay payment ID (pay_...), or
            your registered email/phone.
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorCard, { borderColor: "#FECACA" }]}>
            <Ionicons name="alert-circle" size={18} color="#B91C1C" />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorText}>{error}</Text>
              {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
            </View>
          </View>
        ) : null}

        {tracking ? (
          <View style={styles.results}>
            <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderId, { color: tokens.textPrimary }]}>Order {tracking.orderId}</Text>
                  {tracking.trackingNumber ? (
                    <Text style={[styles.meta, { color: tokens.textTertiary }]}>
                      Tracking: {tracking.trackingNumber}
                      {tracking.carrier ? ` via ${tracking.carrier}` : ""}
                    </Text>
                  ) : null}
                </View>
                {tracking.estimatedDelivery ? (
                  <View style={styles.eta}>
                    <Text style={[styles.etaLabel, { color: tokens.textTertiary }]}>Est. delivery</Text>
                    <Text style={[styles.etaValue, { color: tokens.textPrimary }]}>{tracking.estimatedDelivery}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.stepsRow}>
                {STEPS.map((step, i) => {
                  const done = activeIndex >= 0 && i <= activeIndex
                  return (
                    <View key={step.key} style={styles.step}>
                      {i > 0 ? (
                        <View
                          style={[
                            styles.connector,
                            { backgroundColor: done ? step.color : tokens.border },
                          ]}
                        />
                      ) : null}
                      <View
                        style={[
                          styles.stepIcon,
                          { backgroundColor: done ? step.color : tokens.primarySubtle },
                        ]}
                      >
                        <Ionicons
                          name={step.icon}
                          size={15}
                          color={done ? brand.textInverse : tokens.textTertiary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.stepLabel,
                          { color: done ? tokens.textPrimary : tokens.textTertiary },
                        ]}
                        numberOfLines={2}
                      >
                        {step.label}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>

            {tracking.origin || tracking.destination ? (
              <View style={styles.routeRow}>
                <View style={[styles.routeCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
                  <Text style={[styles.routeLabel, { color: tokens.textTertiary }]}>Origin</Text>
                  <Text style={[styles.routeValue, { color: tokens.textPrimary }]}>{tracking.origin ?? "—"}</Text>
                </View>
                <View style={[styles.routeCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
                  <Text style={[styles.routeLabel, { color: tokens.textTertiary }]}>Destination</Text>
                  <Text style={[styles.routeValue, { color: tokens.textPrimary }]}>{tracking.destination ?? "—"}</Text>
                </View>
              </View>
            ) : null}

            {tracking.events?.length ? (
              <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
                <View style={styles.historyHead}>
                  <Ionicons name="time-outline" size={16} color={tokens.primary} />
                  <Text style={[styles.historyTitle, { color: tokens.primary }]}>Tracking History</Text>
                </View>
                {tracking.events.map((ev, i) => (
                  <View key={`${ev.status}-${i}`} style={styles.event}>
                    <View style={styles.eventRail}>
                      <View style={[styles.eventDot, { backgroundColor: i === 0 ? tokens.primary : tokens.border }]} />
                      {i < (tracking.events?.length ?? 0) - 1 ? (
                        <View style={[styles.eventLine, { backgroundColor: tokens.border }]} />
                      ) : null}
                    </View>
                    <View style={styles.eventBody}>
                      <Text style={[styles.eventStatus, { color: tokens.textPrimary }]}>{ev.status}</Text>
                      {ev.description ? (
                        <Text style={[styles.eventDesc, { color: tokens.textSecondary }]}>{ev.description}</Text>
                      ) : null}
                      <View style={styles.eventMetaRow}>
                        {ev.timestamp ? (
                          <Text style={[styles.eventMeta, { color: tokens.textTertiary }]}>{ev.timestamp}</Text>
                        ) : null}
                        {ev.location ? (
                          <View style={styles.eventLoc}>
                            <Ionicons name="location-outline" size={11} color={tokens.textTertiary} />
                            <Text style={[styles.eventMeta, { color: tokens.textTertiary }]}>{ev.location}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : !error && !busy ? (
          <View style={styles.placeholder}>
            <EmptyState
              icon="navigate-outline"
              title="Enter your Order ID above"
              message="You'll see real-time tracking with shipment status at every stage."
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  hero: { padding: spacing.lg, paddingBottom: spacing.xl },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginTop: spacing.md },
  heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 6, lineHeight: 19 },
  searchRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  searchInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    color: "#FFFFFF",
    fontSize: 13,
  },
  trackBtn: { paddingHorizontal: spacing.lg, borderRadius: 10, alignItems: "center", justifyContent: "center", minWidth: 72 },
  trackBtnText: { fontWeight: "800", fontSize: 14 },
  disabled: { opacity: 0.5 },
  heroHelp: { color: "rgba(255,255,255,0.65)", fontSize: 11, lineHeight: 16, marginTop: spacing.md },
  errorCard: {
    flexDirection: "row",
    gap: spacing.sm,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#FEF2F2",
  },
  errorText: { color: "#991B1B", fontSize: 13, fontWeight: "600" },
  hintText: { color: "#B91C1C", fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  results: { padding: spacing.lg, gap: spacing.md },
  card: { borderRadius: 12, borderWidth: 1, padding: spacing.lg },
  cardHead: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  orderId: { fontSize: 15, fontWeight: "800" },
  meta: { fontSize: 11.5, marginTop: 3 },
  eta: { alignItems: "flex-end" },
  etaLabel: { fontSize: 10.5 },
  etaValue: { fontSize: 12.5, fontWeight: "700", marginTop: 2 },
  stepsRow: { flexDirection: "row" },
  step: { flex: 1, alignItems: "center" },
  connector: { position: "absolute", top: 15, right: "50%", left: "-50%", height: 2 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: 5 },
  routeRow: { flexDirection: "row", gap: spacing.md },
  routeCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: spacing.md },
  routeLabel: { fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  routeValue: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  historyHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg },
  historyTitle: { fontSize: 13.5, fontWeight: "800" },
  event: { flexDirection: "row", gap: spacing.md },
  eventRail: { alignItems: "center", width: 12 },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  eventLine: { width: 2, flex: 1, marginVertical: 2 },
  eventBody: { flex: 1, paddingBottom: spacing.lg },
  eventStatus: { fontSize: 13, fontWeight: "700" },
  eventDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  eventMetaRow: { flexDirection: "row", gap: spacing.md, marginTop: 4, flexWrap: "wrap" },
  eventLoc: { flexDirection: "row", alignItems: "center", gap: 3 },
  eventMeta: { fontSize: 11 },
  placeholder: { height: 320 },
})
