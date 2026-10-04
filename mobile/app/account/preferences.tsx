import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native"
import { SignInRequired } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { apiRequest } from "@/api/client"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

interface Consent {
  email: boolean
  whatsapp: boolean
  sms: boolean
}

interface Profile {
  tier?: string
  lifetimeSpend?: number
  orderCount?: number
  consent?: Consent
}

const CHANNELS: { key: keyof Consent; label: string; description: string }[] = [
  { key: "email", label: "Email", description: "Offers, price drops and new arrivals" },
  { key: "whatsapp", label: "WhatsApp", description: "Deal alerts and service reminders" },
  { key: "sms", label: "SMS", description: "Occasional time-sensitive offers" },
]

export default function PreferencesScreen() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { tokens, brand } = useTheme()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<keyof Consent | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    apiRequest<{ profile: Profile }>("/api/account/preferences", { auth: true })
      .then((res) => {
        if (!cancelled) setProfile(res.profile)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your preferences.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const toggle = async (key: keyof Consent, next: boolean) => {
    const previous = profile?.consent?.[key] ?? false
    // Optimistic, then reverted on failure — same behaviour as the website.
    setProfile((p) => (p ? { ...p, consent: { ...(p.consent ?? { email: false, whatsapp: false, sms: false }), [key]: next } } : p))
    setSavingKey(key)
    setError(null)
    try {
      const res = await apiRequest<{ profile: Profile }>("/api/account/preferences", {
        method: "PUT",
        auth: true,
        body: { [key]: next },
      })
      setProfile(res.profile)
    } catch {
      setProfile((p) =>
        p ? { ...p, consent: { ...(p.consent ?? { email: false, whatsapp: false, sms: false }), [key]: previous } } : p,
      )
      setError("Could not save that change")
    } finally {
      setSavingKey(null)
    }
  }

  const stat = (label: string, value: string) => (
    <View style={[styles.stat, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
      <Text style={[styles.statLabel, { color: tokens.textTertiary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: tokens.textPrimary }]}>{value}</Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <Text style={[styles.pageTitle, { color: tokens.textPrimary }]}>Communication preferences</Text>
      <Text style={[styles.pageSub, { color: tokens.textSecondary }]}>
        Choose how you&apos;d like to hear from Sara. You can change this at any time.
      </Text>

      {authLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : !isAuthenticated ? (
        <SignInRequired
          title="Sign in to manage preferences"
          message="Control which offers and alerts we send you."
        />
      ) : loading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.statRow}>
            {stat("Membership", profile?.tier ? profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1) : "—")}
            {stat("Orders", String(profile?.orderCount ?? 0))}
            {stat("Total spent", formatInr(profile?.lifetimeSpend ?? 0))}
          </View>

          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <View style={styles.cardHead}>
              <Ionicons name="notifications-outline" size={17} color={tokens.primary} />
              <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>Marketing messages</Text>
            </View>

            {CHANNELS.map((channel, i) => (
              <View
                key={channel.key}
                style={[styles.channel, i > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.channelLabel, { color: tokens.textPrimary }]}>{channel.label}</Text>
                  <Text style={[styles.channelDesc, { color: tokens.textSecondary }]}>{channel.description}</Text>
                </View>
                {savingKey === channel.key ? (
                  <ActivityIndicator color={tokens.primary} size="small" />
                ) : (
                  <Switch
                    value={profile?.consent?.[channel.key] ?? false}
                    onValueChange={(next) => void toggle(channel.key, next)}
                    trackColor={{ false: tokens.border, true: tokens.primary }}
                    thumbColor={brand.textInverse}
                  />
                )}
              </View>
            ))}
          </View>

          {error ? <Text style={[styles.error, { color: brand.danger }]}>{error}</Text> : null}

          <Text style={[styles.footnote, { color: tokens.textTertiary }]}>
            We&apos;ll always email you about your own orders and deliveries — those are service messages, not
            marketing, and they aren&apos;t affected by these settings.
          </Text>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 19, fontWeight: "800", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  pageSub: { fontSize: 12.5, paddingHorizontal: spacing.lg, paddingTop: 4, lineHeight: 18 },
  spinner: { marginTop: spacing.xxl },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  statRow: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, borderRadius: 10, borderWidth: 1, padding: spacing.md },
  statLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  statValue: { fontSize: 14, fontWeight: "800", marginTop: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: spacing.lg },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: spacing.sm },
  cardTitle: { fontSize: 14.5, fontWeight: "800" },
  channel: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  channelLabel: { fontSize: 14, fontWeight: "700" },
  channelDesc: { fontSize: 12, marginTop: 2 },
  error: { fontSize: 12.5, fontWeight: "600" },
  footnote: { fontSize: 11.5, lineHeight: 17 },
})
