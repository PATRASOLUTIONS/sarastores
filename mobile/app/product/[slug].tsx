import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { Image } from "expo-image"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { fetchProduct, fetchReviews, fetchSpecifications } from "@/api/catalog"
import { StoreHeader } from "@/components/StoreHeader"
import { useCart } from "@/cart/context"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

/** Same tab set, in the same order, as the website's PDP. */
const TABS = ["Overview", "Specifications", "In the Box", "Offers", "EMI Options", "Reviews", "FAQs"] as const
type Tab = (typeof TABS)[number]

const TRUST = [
  { icon: "refresh-outline", label: "7 Days Replacement" },
  { icon: "shield-checkmark-outline", label: "1 Year Warranty" },
  { icon: "ribbon-outline", label: "100% Genuine" },
  { icon: "lock-closed-outline", label: "Secure Payment" },
] as const

/** The website quotes a delivery date rather than a lead time. */
function deliveryDate(days = 3): string {
  const date = new Date(Date.now() + days * 86400000)
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { tokens, brand } = useTheme()
  const { add, items } = useCart()

  const [active, setActive] = useState(0)
  const [tab, setTab] = useState<Tab>("Overview")
  const [added, setAdded] = useState(false)

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProduct(slug!),
    enabled: !!slug,
  })
  const { data: reviews } = useQuery({
    queryKey: ["reviews", product?.id],
    queryFn: () => fetchReviews(product!.id),
    enabled: !!product?.id,
  })
  const { data: specs } = useQuery({
    queryKey: ["specs", product?.sku],
    queryFn: () => fetchSpecifications(product!.sku!),
    enabled: !!product?.sku,
  })

  const gallery = useMemo(
    () => ((product?.images?.length ? product.images : [product?.image]) ?? []).filter(Boolean) as string[],
    [product],
  )

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface }}>
        <StoreHeader />
        <ActivityIndicator style={styles.spinner} color={tokens.primary} size="large" />
      </View>
    )
  }
  if (isError || !product) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface }}>
        <StoreHeader />
        <Text style={[styles.hint, { color: brand.danger }]}>Product not found.</Text>
      </View>
    )
  }

  const display = product.display
  const soldOut = display ? !display.inStock : product.stock === 0
  const inCart = items.some((item) => item.id === product.id)

  const handleAdd = () => {
    add(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const specEntries = Object.entries((specs ?? {}) as Record<string, unknown>).filter(
    ([key, value]) =>
      !["_id", "id", "sku", "specification_images", "createdAt", "updatedAt"].includes(key) &&
      (typeof value === "string" || typeof value === "number") &&
      String(value).trim().length > 0,
  )

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.crumbs}>
          <Text style={[styles.crumb, { color: tokens.textTertiary }]}>Home</Text>
          <Text style={[styles.crumb, { color: tokens.textTertiary }]}>/</Text>
          <Text style={[styles.crumb, { color: tokens.textTertiary }]}>{product.category || "Products"}</Text>
          {product.subCategory ? (
            <>
              <Text style={[styles.crumb, { color: tokens.textTertiary }]}>/</Text>
              <Text style={[styles.crumb, { color: tokens.textTertiary }]}>{product.subCategory}</Text>
            </>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.crumbActive, { color: tokens.textPrimary }]}>
          {product.name}
        </Text>

        <View style={[styles.galleryCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
          <Image source={{ uri: gallery[active] }} style={styles.hero} contentFit="contain" transition={180} />
          {gallery.length > 1 ? (
            <>
              <Pressable
                style={[styles.arrow, styles.arrowLeft, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
                onPress={() => setActive((i) => (i - 1 + gallery.length) % gallery.length)}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={17} color={tokens.textSecondary} />
              </Pressable>
              <Pressable
                style={[styles.arrow, styles.arrowRight, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
                onPress={() => setActive((i) => (i + 1) % gallery.length)}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={17} color={tokens.textSecondary} />
              </Pressable>
            </>
          ) : null}

          {gallery.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {gallery.map((uri, index) => (
                <Pressable
                  key={`${uri}-${index}`}
                  onPress={() => setActive(index)}
                  style={[
                    styles.thumb,
                    { borderColor: index === active ? tokens.primary : tokens.border },
                  ]}
                >
                  <Image source={{ uri }} style={styles.thumbImage} contentFit="contain" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: tokens.textPrimary }]}>{product.name}</Text>

          {display && display.reviewCount > 0 ? (
            <View style={styles.ratingRow}>
              <View style={[styles.ratingPill, { backgroundColor: tokens.success }]}>
                <Text style={styles.ratingPillText}>{display.rating.toFixed(1)}</Text>
                <Ionicons name="star" size={10} color="#FFFFFF" />
              </View>
              <Text style={[styles.reviewCount, { color: tokens.textSecondary }]}>
                ({display.reviewCount} reviews)
              </Text>
            </View>
          ) : null}

          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: tokens.primarySubtle }]}>
              <Ionicons name="checkmark-circle" size={12} color={tokens.primary} />
              <Text style={[styles.chipText, { color: tokens.primary }]}>Brand Authorised</Text>
            </View>
            {product.subCategory ? (
              <View style={[styles.chip, { backgroundColor: tokens.primarySubtle }]}>
                <Text style={[styles.chipText, { color: tokens.primary }]}>{product.subCategory}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.price, { color: tokens.textPrimary }]}>{formatInr(product.price)}</Text>
          {display && display.mrp > product.price ? (
            <View style={styles.mrpRow}>
              <Text style={[styles.mrp, { color: tokens.textTertiary }]}>{formatInr(display.mrp)}</Text>
              <Text style={[styles.discount, { color: tokens.success }]}>{display.discountPercent}% off</Text>
            </View>
          ) : null}
          <Text style={[styles.taxNote, { color: tokens.textTertiary }]}>Inclusive of all taxes</Text>

          {display?.emi.available ? (
            <View style={styles.emiRow}>
              <Text style={[styles.emi, { color: tokens.textSecondary }]}>
                {/* price/tenure, matching the website's headline EMI. */}
                EMI from {formatInr(display.emi.perMonth)}/month
              </Text>
              <Pressable onPress={() => setTab("EMI Options")}>
                <Text style={[styles.link, { color: tokens.primary }]}>View EMI options →</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.deliveryCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <View style={styles.deliveryRow}>
              <Ionicons
                name={soldOut ? "close-circle-outline" : "checkmark-circle"}
                size={16}
                color={soldOut ? brand.danger : tokens.success}
              />
              <Text style={[styles.deliveryStrong, { color: soldOut ? brand.danger : tokens.success }]}>
                {soldOut ? "Currently out of stock" : "In stock for delivery"}
              </Text>
            </View>
            {!soldOut ? (
              <>
                <View style={styles.deliveryRow}>
                  <Ionicons name="cube-outline" size={16} color={tokens.textSecondary} />
                  <Text style={[styles.deliveryText, { color: tokens.textPrimary }]}>
                    FREE Delivery by {deliveryDate()}
                  </Text>
                </View>
                <View style={styles.deliveryRow}>
                  <Ionicons name="storefront-outline" size={16} color={tokens.textSecondary} />
                  <Text style={[styles.deliveryText, { color: tokens.textSecondary }]}>
                    Available for Store Pickup
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.trustRow}>
            {TRUST.map((item) => (
              <View key={item.label} style={styles.trustItem}>
                <Ionicons name={item.icon} size={17} color={tokens.primary} />
                <Text style={[styles.trustLabel, { color: tokens.textSecondary }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setTab(item)}
              style={[styles.tab, tab === item && { borderBottomColor: tokens.primary, borderBottomWidth: 2.5 }]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === item ? tokens.primary : tokens.textSecondary, fontWeight: tab === item ? "800" : "600" },
                ]}
              >
                {item === "Reviews" ? `Reviews (${display?.reviewCount ?? 0})` : item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.tabPanel, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
          {tab === "Overview" ? (
            <Text style={[styles.body, { color: tokens.textSecondary }]}>
              {product.description || "No description available for this product."}
            </Text>
          ) : null}

          {tab === "Specifications" ? (
            specEntries.length > 0 ? (
              specEntries.map(([key, value]) => (
                <View key={key} style={[styles.specRow, { borderBottomColor: tokens.border }]}>
                  <Text style={[styles.specKey, { color: tokens.textSecondary }]}>{key.replace(/_/g, " ")}</Text>
                  <Text style={[styles.specValue, { color: tokens.textPrimary }]}>{String(value)}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.body, { color: tokens.textTertiary }]}>
                Specifications for this product aren&apos;t published yet.
              </Text>
            )
          ) : null}

          {tab === "In the Box" ? (
            <Text style={[styles.body, { color: tokens.textSecondary }]}>
              {product.name}, remote, power cable, wall-mount bracket, user manual and warranty card.
            </Text>
          ) : null}

          {tab === "Offers" ? (
            display?.benefits.length ? (
              display.benefits.map((benefit) => (
                <View key={benefit} style={styles.offerRow}>
                  <Ionicons name="pricetag-outline" size={14} color={tokens.success} />
                  <Text style={[styles.body, { color: tokens.textSecondary }]}>{benefit}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.body, { color: tokens.textTertiary }]}>No offers on this product right now.</Text>
            )
          ) : null}

          {tab === "EMI Options" ? (
            display?.emi.available ? (
              <View>
                <Text style={[styles.body, { color: tokens.textPrimary }]}>
                  From {formatInr(display.emi.perMonth)}/month over {display.emi.tenureMonths} months
                </Text>
                {display.emi.lowestPerMonth && display.emi.lowestIssuer ? (
                  <Text style={[styles.body, { color: tokens.textSecondary, marginTop: spacing.sm }]}>
                    Lowest plan: {formatInr(display.emi.lowestPerMonth)}/month with {display.emi.lowestIssuer}
                  </Text>
                ) : null}
                <Text style={[styles.body, { color: tokens.textSecondary, marginTop: spacing.sm }]}>
                  No Cost EMI available up to {display.emi.tenureMonths} months on selected bank cards.
                </Text>
              </View>
            ) : (
              <Text style={[styles.body, { color: tokens.textTertiary }]}>
                EMI isn&apos;t available on this product.
              </Text>
            )
          ) : null}

          {tab === "Reviews" ? (
            reviews && reviews.length > 0 ? (
              reviews.slice(0, 8).map((review) => (
                <View key={review.id} style={[styles.reviewCard, { borderBottomColor: tokens.border }]}>
                  <Text style={{ color: brand.star, fontSize: 12 }}>
                    {"★".repeat(Math.max(0, Math.round(review.rating || 0)))}
                  </Text>
                  {review.comment ? (
                    <Text style={[styles.body, { color: tokens.textPrimary }]}>{review.comment}</Text>
                  ) : null}
                  {review.userName ? (
                    <Text style={[styles.reviewAuthor, { color: tokens.textTertiary }]}>— {review.userName}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={[styles.body, { color: tokens.textTertiary }]}>
                No reviews yet. Be the first to review this product.
              </Text>
            )
          ) : null}

          {tab === "FAQs" ? (
            <Text style={[styles.body, { color: tokens.textTertiary }]}>
              Questions about delivery, installation or warranty? Contact our support team and we&apos;ll help.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: tokens.surfaceRaised, borderTopColor: tokens.border }]}>
        <Pressable
          style={[styles.addButton, { borderColor: soldOut ? tokens.border : tokens.primary }, soldOut && styles.disabled]}
          onPress={handleAdd}
          disabled={soldOut}
        >
          <Text style={[styles.addButtonText, { color: soldOut ? tokens.textTertiary : tokens.primary }]}>
            {added ? "Added ✓" : inCart ? "Add another" : "Add to Cart"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.buyButton, { backgroundColor: tokens.accent }, soldOut && styles.disabled]}
          disabled={soldOut}
          onPress={() => {
            if (!inCart) add(product)
            router.push("/checkout")
          }}
        >
          <Text style={[styles.buyButtonText, { color: brand.textInverse }]}>Buy Now</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  spinner: { marginTop: spacing.xxl },
  hint: { textAlign: "center", marginTop: spacing.xxl, fontWeight: "600" },
  crumbs: { flexDirection: "row", gap: 5, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  crumb: { fontSize: 11.5 },
  crumbActive: { fontSize: 12, fontWeight: "700", paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.md },
  galleryCard: {
    marginHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.lg,
    position: "relative",
  },
  hero: { width: "100%", height: 260 },
  arrow: {
    position: "absolute",
    top: "42%",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  thumbs: { gap: spacing.sm, paddingTop: spacing.lg },
  thumb: { width: 52, height: 52, borderRadius: 7, borderWidth: 2, padding: 3 },
  thumbImage: { width: "100%", height: "100%" },
  info: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  name: { fontSize: 17, fontWeight: "700", lineHeight: 23 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  ratingPillText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" },
  reviewCount: { fontSize: 12.5 },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },
  chipText: { fontSize: 10.5, fontWeight: "700" },
  price: { fontSize: 28, fontWeight: "800", marginTop: spacing.lg },
  mrpRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  mrp: { fontSize: 14, textDecorationLine: "line-through" },
  discount: { fontSize: 14, fontWeight: "700" },
  taxNote: { fontSize: 11.5, marginTop: 2 },
  emiRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  emi: { fontSize: 13 },
  link: { fontSize: 12.5, fontWeight: "700" },
  deliveryCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: 12, borderWidth: 1, gap: spacing.sm },
  deliveryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  deliveryStrong: { fontSize: 13, fontWeight: "700" },
  deliveryText: { fontSize: 12.5 },
  trustRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xl },
  trustItem: { alignItems: "center", gap: 5, flex: 1 },
  trustLabel: { fontSize: 9, fontWeight: "600", textAlign: "center" },
  tabBar: { paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.xl },
  tab: { paddingVertical: spacing.md, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabText: { fontSize: 13 },
  tabPanel: { margin: spacing.lg, marginTop: spacing.sm, padding: spacing.lg, borderRadius: 12, borderWidth: 1 },
  body: { fontSize: 13, lineHeight: 20 },
  specRow: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, gap: spacing.lg },
  specKey: { fontSize: 12, flex: 1, textTransform: "capitalize" },
  specValue: { fontSize: 12, flex: 1.4, fontWeight: "600" },
  offerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 5 },
  reviewCard: { paddingVertical: spacing.md, borderBottomWidth: 1, gap: 3 },
  reviewAuthor: { fontSize: 11 },
  actionBar: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderTopWidth: 1 },
  addButton: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  addButtonText: { fontWeight: "800", fontSize: 14 },
  buyButton: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  buyButtonText: { fontWeight: "800", fontSize: 14 },
  disabled: { opacity: 0.45 },
})
