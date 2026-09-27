import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { EmptyState } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { useCart } from "@/cart/context"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

export default function CartScreen() {
  const { items, subtotal, count, isLoading, setQuantity, remove } = useCart()
  const { tokens, brand } = useTheme()
  const router = useRouter()

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <Text style={[styles.pageTitle, { color: tokens.textPrimary }]}>
        Shopping Cart{count > 0 ? ` (${count})` : ""}
      </Text>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          message="Browse the catalogue and add something you like."
          actionLabel="Start shopping"
          onAction={() => router.push("/(tabs)/search")}
        />
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={[styles.row, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
                <Image source={{ uri: item.image }} style={styles.thumb} contentFit="contain" />
                <View style={styles.rowText}>
                  <Text numberOfLines={2} style={[styles.name, { color: tokens.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.unitPrice, { color: tokens.textTertiary }]}>
                    {formatInr(item.price)} each
                  </Text>

                  <View style={styles.stepper}>
                    <Pressable
                      style={[styles.stepButton, { borderColor: tokens.border }]}
                      onPress={() => setQuantity(item.id, item.quantity - 1)}
                      hitSlop={8}
                    >
                      <Text style={[styles.stepText, { color: tokens.textPrimary }]}>−</Text>
                    </Pressable>
                    <Text style={[styles.qty, { color: tokens.textPrimary }]}>{item.quantity}</Text>
                    <Pressable
                      style={[styles.stepButton, { borderColor: tokens.border }]}
                      onPress={() => setQuantity(item.id, item.quantity + 1)}
                      hitSlop={8}
                    >
                      <Text style={[styles.stepText, { color: tokens.textPrimary }]}>+</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(item.id)} hitSlop={8} style={styles.removeButton}>
                      <Text style={[styles.remove, { color: brand.danger }]}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={[styles.linePrice, { color: tokens.textPrimary }]}>
                  {formatInr(item.price * item.quantity)}
                </Text>
              </View>
            )}
          />

          <View style={[styles.footer, { backgroundColor: tokens.surfaceRaised, borderTopColor: tokens.border }]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: tokens.textSecondary }]}>
                Subtotal ({count} item{count === 1 ? "" : "s"})
              </Text>
              <Text style={[styles.totalValue, { color: tokens.textPrimary }]}>{formatInr(subtotal)}</Text>
            </View>
            <Text style={[styles.footnote, { color: tokens.textTertiary }]}>
              Taxes, delivery and any coupon are calculated by our server at checkout.
            </Text>
            <Pressable
              style={[styles.checkout, { backgroundColor: tokens.accent }]}
              onPress={() => router.push("/checkout")}
            >
              <Text style={[styles.checkoutText, { color: brand.textInverse }]}>Proceed to Checkout</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 19, fontWeight: "800", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  spinner: { marginTop: spacing.xxl },
  row: { flexDirection: "row", padding: spacing.md, borderRadius: 12, borderWidth: 1 },
  thumb: { width: 62, height: 62, borderRadius: 8 },
  rowText: { flex: 1, paddingHorizontal: spacing.md },
  name: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  unitPrice: { fontSize: 11.5, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm },
  stepButton: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 15, lineHeight: 17 },
  qty: { minWidth: 22, textAlign: "center", fontWeight: "800", fontSize: 13 },
  removeButton: { marginLeft: spacing.xs },
  remove: { fontSize: 11.5, fontWeight: "700" },
  linePrice: { fontSize: 14, fontWeight: "800" },
  footer: { padding: spacing.lg, borderTopWidth: 1 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13.5 },
  totalValue: { fontSize: 20, fontWeight: "800" },
  footnote: { fontSize: 11, marginTop: spacing.xs },
  checkout: { marginTop: spacing.md, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  checkoutText: { fontWeight: "800", fontSize: 15 },
})
