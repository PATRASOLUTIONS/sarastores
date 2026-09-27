import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { Image } from "expo-image"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { EmptyState } from "@/components/States"
import { ProductCard } from "@/components/ProductCard"
import { StoreHeader } from "@/components/StoreHeader"
import { fetchBrand, fetchProducts } from "@/api/catalog"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

export default function BrandDetailScreen() {
  const { tokens, brand: palette } = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ slug?: string }>()
  const slug = typeof params.slug === "string" ? params.slug : ""

  const { data: brand, isLoading } = useQuery({
    queryKey: ["brand", slug],
    queryFn: () => fetchBrand(slug),
    enabled: Boolean(slug),
  })

  const brandName = brand?.name ?? slug
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["brand-products", brandName],
    queryFn: () => fetchProducts({ search: brandName, limit: brand?.productsSection?.maxProducts ?? 12 }),
    enabled: Boolean(brandName),
  })

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface }}>
        <StoreHeader />
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      </View>
    )
  }

  if (!brand) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface }}>
        <StoreHeader />
        <EmptyState
          icon="pricetags-outline"
          title="Brand not found"
          message="We couldn't find that brand. Browse all brands instead."
          actionLabel="All brands"
          onAction={() => router.replace("/brands")}
        />
      </View>
    )
  }

  const hero = brand.heroContent
  const reasons = brand.whyChoose?.reasons ?? []

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.crumb, { color: tokens.textTertiary }]}>Home / Brands / {brand.name}</Text>

        <View style={[styles.hero, { backgroundColor: tokens.primary }]}>
          {brand.logo ? (
            <View style={styles.logoChip}>
              <Image source={{ uri: brand.logo }} style={styles.logo} contentFit="contain" />
            </View>
          ) : null}
          <Text style={styles.heroTitle}>{hero?.title ?? brand.name.toUpperCase()}</Text>
          {hero?.subtitle || brand.tagline ? (
            <Text style={styles.heroSub}>{hero?.subtitle ?? brand.tagline}</Text>
          ) : null}
          {hero?.description || brand.description ? (
            <Text style={styles.heroDesc}>{hero?.description ?? brand.description}</Text>
          ) : null}
        </View>

        {brand.features?.length ? (
          <View style={styles.featureRow}>
            {brand.features.slice(0, 4).map((feature, i) => (
              <View
                key={`${feature.text}-${i}`}
                style={[styles.feature, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
              >
                <Ionicons name="checkmark-circle" size={14} color={tokens.success} />
                <Text style={[styles.featureText, { color: tokens.textSecondary }]} numberOfLines={2}>
                  {feature.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {brand.categories?.length ? (
          <View style={styles.block}>
            <Text style={[styles.blockTitle, { color: tokens.textPrimary }]}>{brand.name} Product Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
              {brand.categories.map((cat, i) => (
                <Pressable
                  key={`${cat.title}-${i}`}
                  style={[styles.catCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
                  onPress={() => router.push({ pathname: "/(tabs)/search", params: { q: `${brand.name} ${cat.title}` } })}
                >
                  {cat.url ? <Image source={{ uri: cat.url }} style={styles.catImage} contentFit="contain" /> : null}
                  <Text style={[styles.catTitle, { color: tokens.textPrimary }]} numberOfLines={2}>
                    {cat.title}
                  </Text>
                  {cat.description ? (
                    <Text style={[styles.catDesc, { color: tokens.textTertiary }]} numberOfLines={2}>
                      {cat.description}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {reasons.length ? (
          <View style={styles.block}>
            <Text style={[styles.blockTitle, { color: tokens.textPrimary }]}>
              {brand.whyChoose?.heading ?? `Why Choose ${brand.name}?`}
            </Text>
            {brand.whyChoose?.subtitle ? (
              <Text style={[styles.blockSub, { color: tokens.textSecondary }]}>{brand.whyChoose.subtitle}</Text>
            ) : null}
            {reasons.map((reason, i) => (
              <View
                key={`${reason.title}-${i}`}
                style={[styles.reason, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
              >
                <View style={[styles.reasonIcon, { backgroundColor: tokens.primarySubtle }]}>
                  <Ionicons name="star" size={15} color={tokens.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reasonTitle, { color: tokens.textPrimary }]}>{reason.title}</Text>
                  {reason.description ? (
                    <Text style={[styles.reasonBody, { color: tokens.textSecondary }]}>{reason.description}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: tokens.textPrimary }]}>
            {brand.productsSection?.heading ?? `Shop ${brand.name} Products`}
          </Text>
          {brand.productsSection?.subtitle ? (
            <Text style={[styles.blockSub, { color: tokens.textSecondary }]}>{brand.productsSection.subtitle}</Text>
          ) : null}

          {productsLoading ? (
            <ActivityIndicator style={styles.spinner} color={tokens.primary} />
          ) : products?.length ? (
            <View style={styles.grid}>
              {products.map((product) => (
                <View key={product.id} style={styles.gridItem}>
                  <ProductCard product={product} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="cube-outline"
              title="No products listed yet"
              message={`We're adding ${brand.name} products soon.`}
            />
          )}

          <Pressable
            style={[styles.cta, { backgroundColor: palette.logo }]}
            onPress={() => router.push({ pathname: "/(tabs)/search", params: { q: brand.name } })}
          >
            <Text style={styles.ctaText}>View all {brand.name} products</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  spinner: { marginVertical: spacing.xxl },
  crumb: { fontSize: 11.5, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  hero: { margin: spacing.lg, marginTop: 0, padding: spacing.xl, borderRadius: 14 },
  logoChip: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  logo: { width: 88, height: 30 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600", marginTop: 6 },
  heroDesc: { color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  featureRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featureText: { fontSize: 11, fontWeight: "600" },
  block: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  blockTitle: { fontSize: 17, fontWeight: "800" },
  blockSub: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  catRow: { gap: spacing.md, paddingVertical: spacing.md },
  catCard: { width: 150, borderRadius: 12, borderWidth: 1, padding: spacing.md },
  catImage: { width: "100%", height: 76, borderRadius: 8, marginBottom: spacing.sm },
  catTitle: { fontSize: 13, fontWeight: "700" },
  catDesc: { fontSize: 11, marginTop: 3, lineHeight: 15 },
  reason: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: 12, borderWidth: 1, marginTop: spacing.md },
  reasonIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  reasonTitle: { fontSize: 13.5, fontWeight: "800" },
  reasonBody: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  gridItem: { width: "47.5%" },
  cta: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: spacing.lg },
  ctaText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
})
