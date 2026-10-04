import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { fetchCategories, fetchProducts } from "@/api/catalog"
import type { Product } from "@/api/types"
import { ProductCard } from "@/components/ProductCard"
import { StoreHeader } from "@/components/StoreHeader"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

/** Same options, in the same order, as the website's Sort By control. */
const SORTS = [
  "Popularity",
  "Price: Low to High",
  "Price: High to Low",
  "Discount",
  "Newest First",
  "Customer Rating",
  "Name: A to Z",
] as const
type Sort = (typeof SORTS)[number]

const isTestCategory = (name: string) => /^test\d*$/i.test(name.trim())

/** Matches the server's MAX_LIMIT ceiling for a single response. */
const PAGE_SIZE = 200

function sortProducts(list: Product[], sort: Sort): Product[] {
  const out = [...list]
  switch (sort) {
    case "Price: Low to High":
      return out.sort((a, b) => a.price - b.price)
    case "Price: High to Low":
      return out.sort((a, b) => b.price - a.price)
    case "Discount":
      return out.sort((a, b) => (b.display?.discountPercent ?? 0) - (a.display?.discountPercent ?? 0))
    case "Customer Rating":
      return out.sort((a, b) => (b.display?.rating ?? 0) - (a.display?.rating ?? 0))
    case "Name: A to Z":
      return out.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    case "Newest First":
    case "Popularity":
    default:
      // The server already returns catalogue order; in-stock first is the only
      // reordering worth doing, so shoppers don't hit a wall of sold-out cards.
      return out.sort((a, b) => Number(b.display?.inStock ?? true) - Number(a.display?.inStock ?? true))
  }
}

export default function ProductsScreen() {
  const { tokens, brand } = useTheme()
  const params = useLocalSearchParams<{ q?: string }>()
  const incoming = typeof params.q === "string" ? params.q : ""

  const [term, setTerm] = useState(incoming)
  const [debounced, setDebounced] = useState(incoming)
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>("Popularity")
  const [sortOpen, setSortOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 350)
    return () => clearTimeout(timer)
  }, [term])

  // Brand and category screens deep-link in with ?q=, which must win over stale state.
  useEffect(() => {
    if (incoming) setTerm(incoming)
  }, [incoming])

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["products", "browse", debounced, category],
    queryFn: () =>
      fetchProducts({
        limit: PAGE_SIZE,
        ...(debounced.length >= 2 ? { search: debounced } : {}),
        ...(category ? { category } : {}),
      }),
  })

  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories })
  const visibleCategories = (categories ?? []).filter(
    (c) => c.isEnabled !== false && c.name && !isTestCategory(c.name),
  )

  const products = useMemo(() => sortProducts(data ?? [], sort), [data, sort])

  const header = (
    <View>
      <View style={styles.crumbs}>
        <Text style={[styles.crumb, { color: tokens.textTertiary }]}>Home</Text>
        <Text style={[styles.crumb, { color: tokens.textTertiary }]}>/</Text>
        <Text style={[styles.crumbActive, { color: tokens.textPrimary }]}>All Products</Text>
      </View>

      <LinearGradient
        colors={["#1F72D0", "#0A3A7A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <Text style={styles.bannerTitle}>Electronics For A Better Everyday</Text>
        <Text style={styles.bannerSub}>Top Brands | Great Offers | Expert Advice</Text>
        <Pressable style={styles.bannerCta} onPress={() => setCategory(null)}>
          <Text style={styles.bannerCtaText}>Shop Now</Text>
          <Ionicons name="arrow-forward" size={14} color="#0A3A7A" />
        </Pressable>
      </LinearGradient>

      {visibleCategories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
          <Pressable
            style={[
              styles.tile,
              { borderColor: category === null ? tokens.primary : tokens.border, backgroundColor: tokens.surfaceRaised },
            ]}
            onPress={() => setCategory(null)}
          >
            <Ionicons name="apps-outline" size={22} color={tokens.textSecondary} />
            <Text numberOfLines={2} style={[styles.tileLabel, { color: tokens.textSecondary }]}>
              ALL
            </Text>
          </Pressable>
          {visibleCategories.map((item) => (
            <Pressable
              key={item.id}
              style={[
                styles.tile,
                {
                  borderColor: category === item.name ? tokens.primary : tokens.border,
                  backgroundColor: tokens.surfaceRaised,
                },
              ]}
              onPress={() => setCategory(category === item.name ? null : item.name)}
            >
              <Ionicons name="cube-outline" size={22} color={tokens.textSecondary} />
              <Text numberOfLines={2} style={[styles.tileLabel, { color: tokens.textSecondary }]}>
                {item.name.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.toolbar}>
        <Pressable
          style={[styles.filterButton, { borderColor: tokens.border, backgroundColor: tokens.surfaceRaised }]}
          onPress={() => setSortOpen(true)}
        >
          <Ionicons name="options-outline" size={16} color={tokens.textPrimary} />
          <Text style={[styles.filterText, { color: tokens.textPrimary }]}>Filters</Text>
        </Pressable>
        <Text style={[styles.count, { color: tokens.textTertiary }]}>
          {/* The server caps a page at PAGE_SIZE, so a full page means "at least". */}
          {products.length}
          {products.length === PAGE_SIZE ? "+" : ""} product{products.length === 1 ? "" : "s"}
        </Text>
      </View>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader searchValue={term} onSearchChange={setTerm} />

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} size="large" />
      ) : (
        <FlatList
          data={isError ? [] : products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.column}
          renderItem={({ item }) => <ProductCard product={item} />}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={tokens.primary} />
          }
          ListEmptyComponent={
            <Text style={[styles.hint, { color: tokens.textTertiary }]}>
              {isError
                ? "Couldn't load products. Pull down to retry."
                : debounced
                  ? `No matches for “${debounced}”.`
                  : "No products available right now."}
            </Text>
          }
        />
      )}

      <Modal visible={sortOpen} transparent animationType="slide" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: tokens.surfaceRaised }]}>
            <Text style={[styles.sheetTitle, { color: tokens.textPrimary }]}>Sort By</Text>
            {SORTS.map((option) => (
              <Pressable
                key={option}
                style={styles.sheetRow}
                onPress={() => {
                  setSort(option)
                  setSortOpen(false)
                }}
              >
                <Text style={[styles.sheetLabel, { color: tokens.textPrimary }]}>{option}</Text>
                {sort === option ? <Ionicons name="checkmark" size={18} color={tokens.primary} /> : null}
              </Pressable>
            ))}
            <Pressable style={styles.sheetRow} onPress={() => setSortOpen(false)}>
              <Text style={[styles.sheetLabel, { color: brand.danger }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  column: { paddingHorizontal: spacing.sm },
  spinner: { marginTop: spacing.xxl },
  crumbs: { flexDirection: "row", gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  crumb: { fontSize: 12 },
  crumbActive: { fontSize: 12, fontWeight: "700" },
  banner: { marginHorizontal: spacing.lg, borderRadius: 14, padding: spacing.xl },
  bannerTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", lineHeight: 31 },
  bannerSub: { color: "#DCE6FA", fontSize: 13, marginTop: spacing.sm },
  bannerCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: spacing.lg,
  },
  bannerCtaText: { color: "#0A3A7A", fontWeight: "800", fontSize: 13.5 },
  tiles: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md },
  tile: {
    width: 82,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  tileLabel: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: "700" },
  count: { fontSize: 12 },
  hint: { textAlign: "center", marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing.xl, paddingBottom: spacing.xxl },
  sheetTitle: { fontSize: 17, fontWeight: "800", marginBottom: spacing.md },
  sheetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13 },
  sheetLabel: { fontSize: 15 },
})
