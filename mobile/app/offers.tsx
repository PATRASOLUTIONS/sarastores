import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { StoreHeader } from "@/components/StoreHeader"
import { fetchOffers, type Offer } from "@/api/catalog"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

const SECTIONS = [
  { key: "todays-deals", title: "Today's Deals" },
  { key: "mega-sale", title: "Mega Sale" },
  { key: "clearance", title: "Clearance" },
  { key: "store-exclusive", title: "Store Exclusive" },
] as const

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: "card-outline",
    title: "No-Cost EMI",
    body: "Split your purchase into equal monthly instalments with 0% interest on major credit and debit cards. Available on eligible products above ₹5,000.",
  },
  {
    icon: "construct-outline",
    title: "Free Installation & Demo",
    body: "Certified engineers install your television, refrigerator, washing machine or air conditioner and walk you through it, at no extra cost on eligible products.",
  },
  {
    icon: "pricetag-outline",
    title: "Bank Card Discounts",
    body: "Instant discounts and cashback with partner bank cards. The applicable offer is shown at checkout before you pay.",
  },
  {
    icon: "ticket-outline",
    title: "Coupon Codes",
    body: "Apply a valid coupon in the cart to see the discount reflected in your order total straight away.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Authorised Warranty",
    body: "Every product carries full manufacturer warranty, with service handled through authorised service centres.",
  },
  {
    icon: "rocket-outline",
    title: "Free Delivery & Installation",
    body: "Free delivery above the order threshold shown at checkout, with installation by certified engineers where applicable.",
  },
]

const GOOD_TO_KNOW = [
  "Offers vary by product, brand and payment method, and can change without notice.",
  "The exact discount that applies to your order is always shown at checkout before payment.",
  "For help choosing an offer, contact our team or visit your nearest store.",
]

function OfferShelf({ section, title }: { section: string; title: string }) {
  const { tokens, brand } = useTheme()
  const { data, isLoading } = useQuery({ queryKey: ["offers", section], queryFn: () => fetchOffers(section) })

  if (isLoading) return <ActivityIndicator style={{ marginVertical: spacing.lg }} color={tokens.primary} />
  if (!data?.length) return null

  return (
    <View style={styles.shelf}>
      <Text style={[styles.shelfTitle, { color: tokens.textPrimary }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
        {data.map((offer: Offer) => (
          <View
            key={offer.id}
            style={[styles.offerCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
          >
            {offer.image ? (
              <Image source={{ uri: offer.image }} style={styles.offerImage} contentFit="contain" />
            ) : (
              <View style={[styles.offerImage, { backgroundColor: tokens.primarySubtle }]} />
            )}
            {offer.badge ? (
              <View style={[styles.offerBadge, { backgroundColor: brand.logo }]}>
                <Text style={styles.offerBadgeText}>{offer.badge}</Text>
              </View>
            ) : null}
            <Text style={[styles.offerName, { color: tokens.textPrimary }]} numberOfLines={2}>
              {offer.name}
            </Text>
            {offer.description ? (
              <Text style={[styles.offerDesc, { color: tokens.textSecondary }]} numberOfLines={2}>
                {offer.description}
              </Text>
            ) : null}
            {offer.offerPrice ? (
              <View style={styles.priceRow}>
                <Text style={[styles.offerPrice, { color: tokens.textPrimary }]}>{formatInr(offer.offerPrice)}</Text>
                {offer.originalPrice ? (
                  <Text style={[styles.mrp, { color: tokens.textTertiary }]}>{formatInr(offer.originalPrice)}</Text>
                ) : null}
                {offer.discount ? <Text style={styles.discount}>{offer.discount}% off</Text> : null}
              </View>
            ) : null}
            {offer.stock ? (
              <Text style={[styles.stock, { color: brand.danger }]}>Only {offer.stock} left</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

export default function OffersScreen() {
  const { tokens, brand } = useTheme()
  const router = useRouter()

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: brand.logo }]}>
          <Text style={styles.overline}>SARA ELECTRONICS</Text>
          <Text style={styles.heroTitle}>Offers & Savings</Text>
          <Text style={styles.heroSub}>
            Every way to pay less at Sara — EMI, bank offers and coupons, explained in one place.
          </Text>
          <Pressable style={styles.heroCta} onPress={() => router.push("/(tabs)/search")}>
            <Text style={[styles.heroCtaText, { color: brand.logo }]}>Shop all products</Text>
          </Pressable>
        </View>

        {SECTIONS.map((section) => (
          <OfferShelf key={section.key} section={section.key} title={section.title} />
        ))}

        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: tokens.textPrimary }]}>Ways to save at SARA</Text>
          {BENEFITS.map((benefit) => (
            <View
              key={benefit.title}
              style={[styles.benefit, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
            >
              <View style={[styles.benefitIcon, { backgroundColor: tokens.primarySubtle }]}>
                <Ionicons name={benefit.icon} size={19} color={tokens.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.benefitTitle, { color: tokens.textPrimary }]}>{benefit.title}</Text>
                <Text style={[styles.benefitBody, { color: tokens.textSecondary }]}>{benefit.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.goodToKnow, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
          <Text style={[styles.blockTitle, { color: tokens.textPrimary, marginBottom: spacing.sm }]}>Good to know</Text>
          {GOOD_TO_KNOW.map((line) => (
            <View key={line} style={styles.bullet}>
              <Text style={[styles.dot, { color: tokens.primary }]}>•</Text>
              <Text style={[styles.bulletText, { color: tokens.textSecondary }]}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  hero: { padding: spacing.xl },
  overline: { color: "rgba(255,255,255,0.85)", fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "800", marginTop: spacing.sm },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  heroCta: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: spacing.lg,
  },
  heroCtaText: { fontWeight: "800", fontSize: 13 },
  shelf: { marginTop: spacing.xl },
  shelfTitle: { fontSize: 17, fontWeight: "800", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  shelfRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  offerCard: { width: 210, borderRadius: 12, borderWidth: 1, padding: spacing.md },
  offerImage: { width: "100%", height: 120, borderRadius: 8 },
  offerBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: spacing.sm },
  offerBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  offerName: { fontSize: 13, fontWeight: "700", marginTop: spacing.sm, lineHeight: 18 },
  offerDesc: { fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, flexWrap: "wrap" },
  offerPrice: { fontSize: 15, fontWeight: "800" },
  mrp: { fontSize: 11.5, textDecorationLine: "line-through" },
  discount: { fontSize: 11.5, fontWeight: "700", color: "#15803D" },
  stock: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  block: { padding: spacing.lg, gap: spacing.md, marginTop: spacing.xl },
  blockTitle: { fontSize: 17, fontWeight: "800" },
  benefit: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: 12, borderWidth: 1 },
  benefitIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  benefitTitle: { fontSize: 14, fontWeight: "800" },
  benefitBody: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  goodToKnow: { margin: spacing.lg, padding: spacing.lg, borderRadius: 12, borderWidth: 1 },
  bullet: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  dot: { fontSize: 15, lineHeight: 19 },
  bulletText: { flex: 1, fontSize: 12.5, lineHeight: 19 },
})
