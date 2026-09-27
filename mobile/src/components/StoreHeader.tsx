import { Ionicons } from "@expo/vector-icons"
import { Link, useRouter } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useCart } from "@/cart/context"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

interface StoreHeaderProps {
  /** Supply both to turn the search row into a live input owned by the screen. */
  searchValue?: string
  onSearchChange?: (value: string) => void
}

/**
 * Mirrors the website's mobile header: dismissible announcement ribbon, then a
 * white bar with the menu, wordmark and account/cart, then the search row.
 *
 * Note this is white with dark icons — the navy header is the desktop layout.
 */
export function StoreHeader({ searchValue, onSearchChange }: StoreHeaderProps = {}) {
  const { tokens, brand, announcement } = useTheme()
  const { count } = useCart()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [ribbonDismissed, setRibbonDismissed] = useState(false)

  return (
    <View style={{ backgroundColor: tokens.surfaceRaised, paddingTop: insets.top }}>
      {announcement && !ribbonDismissed ? (
        <View style={[styles.ribbon, { backgroundColor: tokens.ribbon }]}>
          <Text numberOfLines={1} style={[styles.ribbonText, { color: tokens.ribbonText }]}>
            {announcement}
          </Text>
          <Ionicons name="arrow-forward" size={12} color={tokens.ribbonText} />
          <Pressable onPress={() => setRibbonDismissed(true)} hitSlop={10} style={styles.ribbonClose}>
            <Ionicons name="close" size={14} color={tokens.ribbonText} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.bar}>
        <Pressable hitSlop={8} onPress={() => router.push("/menu")}>
          <Ionicons name="menu" size={26} color={tokens.textPrimary} />
        </Pressable>

        <Link href="/(tabs)" asChild>
          <Pressable style={styles.brandRow} hitSlop={6}>
            <Ionicons name="wifi" size={19} color={brand.logo} />
            <Text style={[styles.wordmark, { color: brand.logo }]}>SARA</Text>
          </Pressable>
        </Link>

        <View style={styles.actions}>
          <Link href="/(tabs)/account" asChild>
            <Pressable hitSlop={8}>
              <Ionicons name="person-outline" size={21} color={tokens.textPrimary} />
            </Pressable>
          </Link>
          <Link href="/(tabs)/cart" asChild>
            <Pressable hitSlop={8}>
              <Ionicons name="cart-outline" size={22} color={tokens.textPrimary} />
              {count > 0 ? (
                <View style={[styles.cartBadge, { backgroundColor: brand.danger }]}>
                  <Text style={styles.cartBadgeText}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.searchRow}>
        {onSearchChange ? (
          <View style={[styles.searchInput, { backgroundColor: tokens.primarySubtle, borderColor: tokens.border }]}>
            <Ionicons name="search" size={16} color={tokens.textTertiary} />
            <TextInput
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder="Search for products, brands and more..."
              placeholderTextColor={tokens.textTertiary}
              style={[styles.searchField, { color: tokens.textPrimary }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchValue ? (
              <Pressable onPress={() => onSearchChange("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={tokens.textTertiary} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable
            style={[styles.searchInput, { backgroundColor: tokens.primarySubtle, borderColor: tokens.border }]}
            onPress={() => router.push("/(tabs)/search")}
          >
            <Ionicons name="search" size={16} color={tokens.textTertiary} />
            <Text style={[styles.searchText, { color: tokens.textTertiary }]}>
              Search for products, brands and more...
            </Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.searchButton, { backgroundColor: "#1560BD" }]}
          onPress={() => router.push("/(tabs)/search")}
        >
          <Ionicons name="search" size={18} color={brand.textInverse} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.xxl,
  },
  ribbonText: { fontSize: 11.5, fontWeight: "700" },
  ribbonClose: { position: "absolute", right: spacing.md },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  wordmark: { fontSize: 23, fontWeight: "900", letterSpacing: 0.5 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchText: { fontSize: 13 },
  searchField: { flex: 1, fontSize: 13, paddingVertical: 2 },
  searchButton: {
    width: 52,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
})
