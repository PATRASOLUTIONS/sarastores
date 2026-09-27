import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { fetchBrands, fetchCategories, fetchProducts, fetchStores } from "@/api/catalog"
import type { Product } from "@/api/types"
import { ProductCard } from "@/components/ProductCard"
import { StoreHeader } from "@/components/StoreHeader"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

/** The website's hero rotates through these; the copy and CTAs are taken from it verbatim. */
const HERO_SLIDES = [
  {
    title: "Big Brands. Bigger Savings.",
    subtitle: "Televisions, refrigerators, washing machines and more",
    cta: "See All Offers",
    href: "/offers",
    points: [
      { icon: "card-outline", label: "No-Cost EMI" },
      { icon: "layers-outline", label: "Free Delivery" },
      { icon: "hardware-chip-outline", label: "Free Installation" },
      { icon: "shield-checkmark-outline", label: "Brand Warranty" },
    ],
  },
  {
    title: "Technology Brings People Closer",
    subtitle: "Mobiles | Electronics | Home Appliances | More",
    cta: "Shop Now",
    href: "/products",
    points: [
      { icon: "sparkles-outline", label: "Latest Technology" },
      { icon: "pricetags-outline", label: "Wide Range of Brands" },
      { icon: "card-outline", label: "Easy EMI Options" },
      { icon: "ribbon-outline", label: "Trusted Since 25 Years" },
    ],
  },
] as const

/** The hero band keeps brand colours through festival themes, so these are fixed. */
const HERO_NAVY = "#0F2557"
const HERO_BLUE = "#1560BD"

/** Same guard the web landing page uses to keep placeholder rows out of the UI. */
const isTestCategory = (name: string) => /^test\d*$/i.test(name.trim())

function Hero() {
  const { tokens, brand } = useTheme()
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const slide = HERO_SLIDES[index]

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % HERO_SLIDES.length), 7000)
    return () => clearInterval(timer)
  }, [])

  const step = (delta: number) =>
    setIndex((i) => (i + delta + HERO_SLIDES.length) % HERO_SLIDES.length)

  return (
    <LinearGradient colors={["#E9F1FB", "#F8FBFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <Text style={[styles.script, { color: HERO_NAVY }]}>Happier Homes</Text>
      <Text style={[styles.script, { color: HERO_NAVY }]}>Brighter Lives</Text>
      <View style={[styles.scriptRule, { backgroundColor: brand.logo }]} />

      <Text style={[styles.heroTitle, { color: HERO_NAVY }]}>{slide.title}</Text>
      <Text style={[styles.heroSub, { color: tokens.textSecondary }]}>{slide.subtitle}</Text>

      <View style={styles.points}>
        {slide.points.map((point) => (
          <View key={point.label} style={styles.point}>
            <Ionicons name={point.icon} size={19} color={HERO_NAVY} />
            <Text style={[styles.pointLabel, { color: HERO_NAVY }]}>{point.label}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.heroCta, { backgroundColor: HERO_BLUE }]}
        onPress={() => router.push(slide.href === "/offers" ? "/offers" : "/(tabs)/search")}
      >
        <Text style={[styles.heroCtaText, { color: brand.textInverse }]}>{slide.cta}</Text>
        <Ionicons name="arrow-forward" size={15} color={brand.textInverse} />
      </Pressable>

      <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => step(-1)} hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color={tokens.textSecondary} />
      </Pressable>
      <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => step(1)} hitSlop={8}>
        <Ionicons name="chevron-forward" size={18} color={tokens.textSecondary} />
      </Pressable>
    </LinearGradient>
  )
}

/** Horizontal product rail used by the New Arrivals shelf. */
function ProductRail({ products }: { products: Product[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
      {products.map((product) => (
        <View key={product.id} style={styles.railItem}>
          <ProductCard product={product} />
        </View>
      ))}
    </ScrollView>
  )
}

const WHY_SARA: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
  { icon: "shield-checkmark-outline", title: "100% Genuine", detail: "Authorised dealer for every brand we sell" },
  { icon: "card-outline", title: "Easy EMI", detail: "No-cost EMI on all major bank cards" },
  { icon: "construct-outline", title: "Free Installation", detail: "Certified engineers, at no extra cost" },
  { icon: "storefront-outline", title: "54+ Stores", detail: "Across Karnataka, with expert advice" },
]

export default function HomeScreen() {
  const { tokens, brand } = useTheme()
  const router = useRouter()

  const { data: products, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["products", "home"],
    queryFn: () => fetchProducts({ limit: 40 }),
  })
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories })
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: fetchBrands })
  const { data: stores } = useQuery({ queryKey: ["stores"], queryFn: fetchStores })

  const visibleCategories = (categories ?? []).filter(
    (c) => c.isEnabled !== false && c.name && !isTestCategory(c.name),
  )
  const topBrands = (brands ?? []).slice(0, 12)
  const newArrivals = (products ?? []).slice(0, 10)

  const header = (
    <View>
      <Hero />

      {visibleCategories.length > 0 ? (
        <View style={[styles.categoryCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Shop by category</Text>
          <View style={styles.categoryGrid}>
            {visibleCategories.map((category) => (
              <Pressable
                key={category.id}
                style={styles.categoryItem}
                onPress={() =>
                  router.push({ pathname: "/category/[id]", params: { id: category.id, name: category.name } })
                }
              >
                <View style={[styles.categoryIcon, { backgroundColor: tokens.primarySubtle }]}>
                  <Ionicons name="cube-outline" size={22} color={tokens.primary} />
                </View>
                <Text numberOfLines={2} style={[styles.categoryLabel, { color: tokens.textSecondary }]}>
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable style={[styles.offerBanner, { backgroundColor: brand.logo }]} onPress={() => router.push("/offers")}>
        <View style={{ flex: 1 }}>
          <Text style={styles.offerBannerTitle}>Featured offers</Text>
          <Text style={styles.offerBannerSub}>No-cost EMI, bank discounts and coupons — all in one place.</Text>
        </View>
        <Ionicons name="arrow-forward-circle" size={28} color="#FFFFFF" />
      </Pressable>

      {topBrands.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Shop by top brands</Text>
            <Pressable onPress={() => router.push("/brands")} hitSlop={6}>
              <Text style={[styles.viewAll, { color: tokens.primary }]}>View all</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRow}>
            {topBrands.map((item) => (
              <Pressable
                key={item.slug ?? item.name}
                style={[styles.brandChip, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
                onPress={() =>
                  item.slug
                    ? router.push({ pathname: "/brands/[slug]", params: { slug: item.slug } })
                    : router.push({ pathname: "/(tabs)/search", params: { q: item.name } })
                }
              >
                <Text style={[styles.brandChipText, { color: tokens.primary }]} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {newArrivals.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>New Arrivals</Text>
            <Pressable onPress={() => router.push("/(tabs)/search")} hitSlop={6}>
              <Text style={[styles.viewAll, { color: tokens.primary }]}>View all</Text>
            </Pressable>
          </View>
          <ProductRail products={newArrivals} />
        </View>
      ) : null}

      <Pressable
        style={[styles.storeBanner, { backgroundColor: tokens.primary }]}
        onPress={() => router.push("/store-locator")}
      >
        <Ionicons name="storefront-outline" size={24} color="#FFFFFF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.storeBannerTitle}>
            {stores?.length ? `${stores.length}+ Stores Across Karnataka` : "Our stores across Karnataka"}
          </Text>
          <Text style={styles.storeBannerSub}>Find your nearest SARA store, see stock and get expert advice.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </Pressable>

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Best Value Today</Text>
      </View>
    </View>
  )

  const footer = (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: tokens.textPrimary, marginBottom: spacing.md }]}>
        Why Shop at SARA?
      </Text>
      <View style={styles.whyGrid}>
        {WHY_SARA.map((item) => (
          <View
            key={item.title}
            style={[styles.whyCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
          >
            <Ionicons name={item.icon} size={20} color={tokens.primary} />
            <Text style={[styles.whyTitle, { color: tokens.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.whyDetail, { color: tokens.textTertiary }]}>{item.detail}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.tagline, { color: tokens.textSecondary }]}>
        Making Everyday A Brighter Tomorrow — from Karnataka, for a brighter tomorrow.
      </Text>
    </View>
  )

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surfaceRaised }}>
        <StoreHeader />
        <ActivityIndicator style={styles.spinner} color={tokens.primary} size="large" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surfaceRaised }}>
      <StoreHeader />
      <FlatList
        data={isError ? [] : (products ?? [])}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.column}
        renderItem={({ item }) => <ProductCard product={item} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={tokens.primary} />}
        ListEmptyComponent={
          <Text style={[styles.hint, { color: tokens.textTertiary }]}>
            {isError ? "Couldn't load products. Pull down to retry." : "No products available right now."}
          </Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  column: { paddingHorizontal: spacing.sm },
  spinner: { marginTop: spacing.xxl },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl, position: "relative" },
  script: { fontSize: 19, fontStyle: "italic", fontWeight: "600", lineHeight: 24 },
  scriptRule: { width: 110, height: 2.5, borderRadius: 2, marginTop: 4, marginBottom: spacing.lg },
  heroTitle: { fontSize: 32, fontWeight: "800", lineHeight: 37 },
  heroSub: { fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.sm },
  points: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.xl },
  point: { width: "33.33%", alignItems: "center", gap: 5, marginBottom: spacing.lg },
  pointLabel: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: spacing.xs,
  },
  heroCtaText: { fontWeight: "800", fontSize: 14 },
  arrow: {
    position: "absolute",
    top: "48%",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLeft: { left: 6 },
  arrowRight: { right: 6 },
  categoryCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
  },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.md },
  categoryItem: { width: "25%", alignItems: "center", gap: 6, marginBottom: spacing.md },
  categoryIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  categoryLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  sectionHead: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  viewAll: { fontSize: 12.5, fontWeight: "700" },
  offerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: 14,
  },
  offerBannerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  offerBannerSub: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 3, lineHeight: 17 },
  brandRow: { gap: spacing.sm, paddingRight: spacing.lg },
  brandChip: { paddingHorizontal: spacing.lg, paddingVertical: 11, borderRadius: 10, borderWidth: 1, minWidth: 96, alignItems: "center" },
  brandChipText: { fontSize: 12.5, fontWeight: "800" },
  railRow: { gap: spacing.md, paddingRight: spacing.lg },
  railItem: { width: 170 },
  storeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: 14,
  },
  storeBannerTitle: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "800" },
  storeBannerSub: { color: "rgba(255,255,255,0.8)", fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  whyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  whyCard: { width: "47.5%", borderRadius: 12, borderWidth: 1, padding: spacing.md },
  whyTitle: { fontSize: 13, fontWeight: "800", marginTop: spacing.sm },
  whyDetail: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  tagline: { fontSize: 12, textAlign: "center", marginTop: spacing.xl, lineHeight: 18 },
  hint: { textAlign: "center", marginTop: spacing.xxl },
})
