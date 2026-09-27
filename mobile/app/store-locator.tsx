import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { EmptyState } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { fetchStores, type Store } from "@/api/catalog"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

export default function StoreLocatorScreen() {
  const { tokens, brand } = useTheme()
  const [term, setTerm] = useState("")

  const { data, isLoading, isError } = useQuery({ queryKey: ["stores"], queryFn: fetchStores })

  const cities = useMemo(() => {
    const set = new Set((data ?? []).map((s) => s.city).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [data])

  const [city, setCity] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return (data ?? []).filter((store) => {
      if (city && store.city !== city) return false
      if (!needle) return true
      return [store.name, store.address, store.city, store.pincode]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    })
  }, [data, term, city])

  const openMap = (store: Store) => {
    const url =
      store.mapUrl ||
      (store.latitude && store.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            [store.name, store.address, store.city].filter(Boolean).join(" "),
          )}`)
    void Linking.openURL(url)
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: tokens.primary }]}>
          <Text style={styles.heroTitle}>Find a SARA Store</Text>
          <Text style={styles.heroSub}>
            {data?.length ? `${data.length}+ stores across Karnataka` : "Stores across Karnataka"} — see products in
            person, collect orders and get expert advice.
          </Text>
        </View>

        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Search by area, city or PIN code"
          placeholderTextColor={tokens.textTertiary}
          style={[
            styles.search,
            { borderColor: tokens.border, backgroundColor: tokens.surfaceRaised, color: tokens.textPrimary },
          ]}
        />

        {cities.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable
              onPress={() => setCity(null)}
              style={[
                styles.chip,
                {
                  backgroundColor: city === null ? tokens.primary : tokens.surfaceRaised,
                  borderColor: city === null ? tokens.primary : tokens.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: city === null ? brand.textInverse : tokens.textSecondary }]}>
                All cities
              </Text>
            </Pressable>
            {cities.map((item) => {
              const active = item === city
              return (
                <Pressable
                  key={item}
                  onPress={() => setCity(active ? null : item)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? tokens.primary : tokens.surfaceRaised,
                      borderColor: active ? tokens.primary : tokens.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? brand.textInverse : tokens.textSecondary }]}>
                    {item}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        {isLoading ? (
          <ActivityIndicator style={styles.spinner} color={tokens.primary} />
        ) : isError ? (
          <EmptyState icon="alert-circle-outline" title="Couldn't load stores" message="Please try again in a moment." />
        ) : filtered.length === 0 ? (
          <EmptyState icon="location-outline" title="No stores found" message="Try a different area or city." />
        ) : (
          <View style={styles.list}>
            <Text style={[styles.count, { color: tokens.textSecondary }]}>
              {filtered.length} store{filtered.length === 1 ? "" : "s"}
            </Text>
            {filtered.map((store) => (
              <View
                key={store.id ?? store.name}
                style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.pin, { backgroundColor: tokens.primarySubtle }]}>
                    <Ionicons name="storefront-outline" size={17} color={tokens.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.storeName, { color: tokens.textPrimary }]}>{store.name}</Text>
                    {store.region ? (
                      <Text style={[styles.region, { color: tokens.textTertiary }]}>{store.region}</Text>
                    ) : null}
                  </View>
                </View>

                {store.address ? (
                  <Text style={[styles.address, { color: tokens.textSecondary }]}>{store.address}</Text>
                ) : null}
                <Text style={[styles.meta, { color: tokens.textTertiary }]}>
                  {[store.city, store.state, store.pincode].filter(Boolean).join(", ")}
                </Text>
                {store.hours ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={13} color={tokens.textTertiary} />
                    <Text style={[styles.meta, { color: tokens.textTertiary }]}>{store.hours}</Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  {store.phone ? (
                    <Pressable
                      style={[styles.action, { borderColor: tokens.border }]}
                      onPress={() => void Linking.openURL(`tel:${store.phone}`)}
                    >
                      <Ionicons name="call-outline" size={14} color={tokens.primary} />
                      <Text style={[styles.actionText, { color: tokens.primary }]}>Call</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={[styles.action, { backgroundColor: tokens.primary, borderColor: tokens.primary }]} onPress={() => openMap(store)}>
                    <Ionicons name="navigate-outline" size={14} color={brand.textInverse} />
                    <Text style={[styles.actionText, { color: brand.textInverse }]}>Directions</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  hero: { margin: spacing.lg, padding: spacing.xl, borderRadius: 14 },
  heroTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: spacing.sm, lineHeight: 18 },
  search: {
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 13.5,
  },
  chipRow: { paddingHorizontal: spacing.lg, gap: 7, paddingVertical: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "700" },
  spinner: { marginVertical: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  count: { fontSize: 12, fontWeight: "600", marginBottom: spacing.xs },
  card: { borderRadius: 12, borderWidth: 1, padding: spacing.lg },
  cardHead: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  pin: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  storeName: { fontSize: 14.5, fontWeight: "800" },
  region: { fontSize: 11, marginTop: 1 },
  address: { fontSize: 12.5, lineHeight: 18, marginTop: spacing.sm },
  meta: { fontSize: 11.5, marginTop: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: { fontSize: 12.5, fontWeight: "800" },
})
