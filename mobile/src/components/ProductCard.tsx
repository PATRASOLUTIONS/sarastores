import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import { Link } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Product } from "@/api/types"
import { useCart } from "@/cart/context"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

/** Matches the website's five-star row: filled, half and empty glyphs. */
function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = rating - index
        const name = fill >= 0.75 ? "star" : fill >= 0.25 ? "star-half" : "star-outline"
        return <Ionicons key={index} name={name} size={11} color={color} />
      })}
    </View>
  )
}

/**
 * Mirrors the web listing card: badge, wishlist heart, star row, price with
 * struck MRP, EMI line, benefit ticks and an outlined Add to Cart.
 *
 * Every number comes from `product.display`, which the server computes, so the
 * app and the website can never advertise different prices or EMI figures.
 */
export function ProductCard({ product }: { product: Product }) {
  const { tokens, brand } = useTheme()
  const { add, items } = useCart()

  const display = product.display
  const mrp = display?.mrp ?? product.mrp ?? 0
  const discount = display?.discountPercent ?? 0
  const outOfStock = display ? !display.inStock : product.stock === 0
  const inCart = items.some((item) => item.id === product.id)

  const badgeColor =
    display?.badge?.tone === "best"
      ? tokens.success
      : display?.badge?.tone === "new"
        ? tokens.primary
        : brand.danger

  return (
    <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
      <Link href={`/product/${product.slug ?? product.id}`} asChild>
        <Pressable>
          <View style={styles.imageWrap}>
            <Image source={{ uri: product.image }} style={styles.image} contentFit="contain" transition={150} />

            {outOfStock ? (
              <View style={styles.stockOverlay}>
                <Text style={[styles.stockText, { color: brand.danger }]}>Out of stock</Text>
              </View>
            ) : null}

            {/* After the overlay so the scrim cannot wash it out. */}
            {display?.badge ? (
              <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                <Text style={styles.badgeText}>{display.badge.label}</Text>
              </View>
            ) : null}

            <Pressable style={[styles.heart, { backgroundColor: tokens.surfaceRaised }]} hitSlop={6}>
              <Ionicons name="heart-outline" size={15} color={tokens.textSecondary} />
            </Pressable>
          </View>

          <Text numberOfLines={2} style={[styles.name, { color: tokens.textPrimary }]}>
            {product.name}
          </Text>

          {display && display.reviewCount > 0 ? (
            <View style={styles.ratingRow}>
              <Stars rating={display.rating} color={brand.star} />
              <Text style={[styles.ratingValue, { color: tokens.textPrimary }]}>{display.rating.toFixed(1)}</Text>
              <Text style={[styles.ratingCount, { color: tokens.textTertiary }]}>({display.reviewCount})</Text>
            </View>
          ) : null}

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: tokens.textPrimary }]}>{formatInr(product.price)}</Text>
            {mrp > product.price ? (
              <Text style={[styles.mrp, { color: tokens.textTertiary }]}>{formatInr(mrp)}</Text>
            ) : null}
            {discount > 0 ? (
              <Text style={[styles.discount, { color: tokens.success }]}>{discount}% off</Text>
            ) : null}
          </View>

          {display?.emi.available ? (
            <Text style={[styles.emi, { color: tokens.textSecondary }]}>
              {/* `perMonth` is price/tenure — the same figure the website advertises. */}
              EMI from {formatInr(display.emi.perMonth)}/month
            </Text>
          ) : null}

          {display?.benefits.length ? (
            <View style={styles.benefits}>
              {display.benefits.slice(0, 3).map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={12} color={tokens.success} />
                  <Text numberOfLines={1} style={[styles.benefitText, { color: tokens.textSecondary }]}>
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Link>

      <Pressable
        style={[
          styles.addButton,
          { borderColor: outOfStock ? tokens.border : tokens.primary },
          outOfStock && styles.addButtonDisabled,
        ]}
        disabled={outOfStock}
        onPress={() => add(product)}
      >
        <Text style={[styles.addButtonText, { color: outOfStock ? tokens.textTertiary : tokens.primary }]}>
          {outOfStock ? "Notify me" : inCart ? "Add another" : "Add to Cart"}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  imageWrap: { height: 130, justifyContent: "center", position: "relative" },
  image: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  heart: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  stockText: { fontWeight: "700", fontSize: 12 },
  name: { marginTop: spacing.sm, fontSize: 12.5, lineHeight: 17, fontWeight: "600", minHeight: 34 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: spacing.xs },
  stars: { flexDirection: "row" },
  ratingValue: { fontSize: 11, fontWeight: "700", marginLeft: 2 },
  ratingCount: { fontSize: 11 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: spacing.xs, flexWrap: "wrap" },
  price: { fontSize: 16, fontWeight: "800" },
  mrp: { fontSize: 11.5, textDecorationLine: "line-through" },
  discount: { fontSize: 11.5, fontWeight: "700" },
  emi: { fontSize: 10.5, marginTop: 2 },
  benefits: { marginTop: spacing.sm, gap: 3 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  benefitText: { fontSize: 10, flex: 1 },
  addButton: {
    marginTop: spacing.md,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
  },
  addButtonDisabled: { opacity: 0.6 },
  addButtonText: { fontSize: 12.5, fontWeight: "700" },
})
