import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { EmptyState } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { fetchBrands, type Brand } from "@/api/catalog"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

const LETTERS = ["All", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), "#"]

const TRUST: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
  { icon: "shield-checkmark-outline", title: "100% Genuine Products", detail: "Direct from Brands" },
  { icon: "pricetag-outline", title: "Easy EMI Options", detail: "All Major Banks" },
  { icon: "layers-outline", title: "Wide Range", detail: "Across Categories" },
  { icon: "rocket-outline", title: "Free & Fast Delivery", detail: "Across Karnataka" },
]

export default function BrandsScreen() {
  const { tokens, brand } = useTheme()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [letter, setLetter] = useState("All")

  const { data, isLoading, isError } = useQuery({ queryKey: ["brands"], queryFn: fetchBrands })

  const filtered = useMemo(() => {
    const list = data ?? []
    const term = search.trim().toLowerCase()
    return list.filter((b) => {
      if (term && !b.name.toLowerCase().includes(term)) return false
      if (letter === "All") return true
      const first = b.name.charAt(0).toUpperCase()
      if (letter === "#") return !/[A-Z]/.test(first)
      return first === letter
    })
  }, [data, search, letter])

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.crumb, { color: tokens.textTertiary }]}>Home / Brands</Text>

        <View style={[styles.hero, { backgroundColor: tokens.primary }]}>
          <Text style={styles.heroTitle}>The Best Brands.{"\n"}All in One Place.</Text>
          <Text style={styles.heroSub}>Top brands. Genuine products. Best deals. Only at SARA.</Text>
          <View style={styles.heroPoints}>
            {[
              { icon: "shield-checkmark-outline" as const, title: "100% Genuine", detail: "Products" },
              { icon: "pricetag-outline" as const, title: "Exclusive", detail: "Brand Offers" },
              { icon: "layers-outline" as const, title: "Wide Range", detail: "Across Categories" },
            ].map((point) => (
              <View key={point.title} style={styles.heroPoint}>
                <Ionicons name={point.icon} size={16} color="#FFFFFF" />
                <View>
                  <Text style={styles.heroPointTitle}>{point.title}</Text>
                  <Text style={styles.heroPointDetail}>{point.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Shop by Brand</Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search for a brand (e.g. Samsung, LG…)"
          placeholderTextColor={tokens.textTertiary}
          style={[
            styles.search,
            { borderColor: tokens.border, backgroundColor: tokens.surfaceRaised, color: tokens.textPrimary },
          ]}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.letterRow}>
          {LETTERS.map((item) => {
            const active = item === letter
            return (
              <Pressable
                key={item}
                onPress={() => setLetter(item)}
                style={[
                  styles.letter,
                  {
                    backgroundColor: active ? tokens.primary : tokens.surfaceRaised,
                    borderColor: active ? tokens.primary : tokens.border,
                  },
                ]}
              >
                <Text style={[styles.letterText, { color: active ? brand.textInverse : tokens.textSecondary }]}>
                  {item}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator style={styles.spinner} color={tokens.primary} />
        ) : isError ? (
          <EmptyState icon="alert-circle-outline" title="Couldn't load brands" message="Please try again in a moment." />
        ) : filtered.length === 0 ? (
          <EmptyState icon="search-outline" title="No brands found" message="Try a different search or letter." />
        ) : (
          <View style={styles.grid}>
            {filtered.map((item: Brand) => (
              <Pressable
                key={item.slug ?? item.name}
                style={[styles.brandCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
                onPress={() =>
                  item.slug
                    ? router.push({ pathname: "/brands/[slug]", params: { slug: item.slug } })
                    : router.push({ pathname: "/(tabs)/search", params: { q: item.name } })
                }
              >
                {item.logo ? (
                  <Image source={{ uri: item.logo }} style={styles.logo} contentFit="contain" />
                ) : (
                  <Text style={[styles.wordmark, { color: tokens.primary }]} numberOfLines={1}>
                    {item.name.toUpperCase()}
                  </Text>
                )}
                <Text style={[styles.brandName, { color: tokens.textSecondary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.explore}>
                  <Text style={[styles.exploreText, { color: tokens.primary }]}>Explore Brand</Text>
                  <Ionicons name="arrow-forward" size={12} color={tokens.primary} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.trustGrid}>
          {TRUST.map((item) => (
            <View
              key={item.title}
              style={[styles.trustCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
            >
              <Ionicons name={item.icon} size={18} color={tokens.primary} />
              <Text style={[styles.trustTitle, { color: tokens.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.trustDetail, { color: tokens.textTertiary }]}>{item.detail}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  crumb: { fontSize: 11.5, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  hero: { margin: spacing.lg, marginTop: 0, padding: spacing.xl, borderRadius: 14 },
  heroTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "800", lineHeight: 30 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: spacing.sm, lineHeight: 18 },
  heroPoints: { gap: spacing.md, marginTop: spacing.lg },
  heroPoint: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroPointTitle: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" },
  heroPointDetail: { color: "rgba(255,255,255,0.75)", fontSize: 11 },
  sectionTitle: { fontSize: 17, fontWeight: "800", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  search: {
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 13.5,
  },
  letterRow: { paddingHorizontal: spacing.lg, gap: 6, paddingVertical: spacing.md },
  letter: { minWidth: 32, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  letterText: { fontSize: 11.5, fontWeight: "700" },
  spinner: { marginVertical: spacing.xxl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  brandCard: { width: "47.5%", borderRadius: 12, borderWidth: 1, padding: spacing.md, alignItems: "center" },
  logo: { width: "100%", height: 42 },
  wordmark: { fontSize: 16, fontWeight: "800", height: 42, lineHeight: 42 },
  brandName: { fontSize: 11.5, marginTop: spacing.sm },
  explore: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: spacing.sm },
  exploreText: { fontSize: 11.5, fontWeight: "700" },
  trustGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.lg, marginTop: spacing.lg },
  trustCard: { width: "47.5%", borderRadius: 12, borderWidth: 1, padding: spacing.md },
  trustTitle: { fontSize: 12.5, fontWeight: "800", marginTop: spacing.sm },
  trustDetail: { fontSize: 11, marginTop: 2 },
})
