import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useQuery } from "@tanstack/react-query"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { EmptyState } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { fetchProductsByIds, fetchSpecifications } from "@/api/catalog"
import { useCart } from "@/cart/context"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

const STORAGE_KEY = "compare_products"
export const MAX_COMPARE_ITEMS = 6

/** Spec rows the website hides — noisy marketplace metadata, not product facts. */
const EXCLUDED = new Set([
  "reviews",
  "review",
  "customer reviews",
  "best sellers rank",
  "bestsellersrank",
  "packer",
])

export default function CompareScreen() {
  const { tokens, brand } = useTheme()
  const router = useRouter()
  const { add } = useCart()

  const [ids, setIds] = useState<string[] | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : []
        setIds(Array.isArray(parsed) ? parsed.slice(0, MAX_COMPARE_ITEMS) : [])
      })
      .catch(() => setIds([]))
  }, [])

  const { data: products, isLoading } = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => fetchProductsByIds(ids ?? []),
    enabled: Array.isArray(ids) && ids.length > 0,
  })

  const { data: specs } = useQuery({
    queryKey: ["compare-specs", products?.map((p) => p.sku ?? p.id).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        (products ?? []).map(async (product) => {
          const raw = await fetchSpecifications(product.sku ?? product.id)
          const body = (raw?.technical_details ?? raw ?? {}) as Record<string, unknown>
          return [product.id, body] as const
        }),
      )
      return Object.fromEntries(entries) as Record<string, Record<string, unknown>>
    },
    enabled: Boolean(products?.length),
  })

  const rows = useMemo(() => {
    if (!specs) return []
    const keys = new Set<string>()
    Object.values(specs).forEach((body) => {
      Object.keys(body ?? {}).forEach((key) => {
        if (!EXCLUDED.has(key.toLowerCase().trim())) keys.add(key)
      })
    })
    return Array.from(keys)
  }, [specs])

  const persist = useCallback(async (next: string[]) => {
    setIds(next)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const remove = (id: string) => void persist((ids ?? []).filter((item) => item !== id))
  const clear = () => void persist([])

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />

      <View style={[styles.bar, { borderBottomColor: tokens.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.crumb, { color: tokens.textTertiary }]}>Products / Compare</Text>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Product Comparison</Text>
          <Text style={[styles.tagline, { color: tokens.textSecondary }]}>
            Compare technical specifications of selected products side-by-side.
          </Text>
        </View>
        {ids?.length ? (
          <Pressable onPress={clear} hitSlop={8}>
            <Text style={[styles.clear, { color: brand.danger }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {ids === null || isLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : !ids.length || !products?.length ? (
        <EmptyState
          icon="git-compare-outline"
          title="Nothing to compare yet"
          message={`Add up to ${MAX_COMPARE_ITEMS} products from any product page to see their specifications side-by-side.`}
          actionLabel="Browse products"
          onAction={() => router.push("/(tabs)/search")}
        />
      ) : (
        <ScrollView horizontal contentContainerStyle={styles.hScroll}>
          <ScrollView contentContainerStyle={styles.vScroll}>
            <View style={styles.headerRow}>
              <View style={[styles.specCol, styles.headCell, { borderColor: tokens.border }]}>
                <Text style={[styles.specHeadText, { color: tokens.textPrimary }]}>Specification</Text>
              </View>
              {products.map((product) => (
                <View
                  key={product.id}
                  style={[styles.productCol, styles.headCell, { borderColor: tokens.border, backgroundColor: tokens.surfaceRaised }]}
                >
                  <Pressable style={styles.removeBtn} onPress={() => remove(product.id)} hitSlop={6}>
                    <Ionicons name="close" size={14} color={tokens.textTertiary} />
                  </Pressable>
                  {product.images?.[0] || product.image ? (
                    <Image
                      source={{ uri: product.images?.[0] ?? product.image }}
                      style={styles.thumb}
                      contentFit="contain"
                    />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: tokens.primarySubtle }]} />
                  )}
                  <Text style={[styles.productName, { color: tokens.textPrimary }]} numberOfLines={3}>
                    {product.name}
                  </Text>
                  <Text style={[styles.price, { color: tokens.textPrimary }]}>{formatInr(product.price)}</Text>
                  <Pressable
                    style={[styles.addBtn, { backgroundColor: tokens.accent }]}
                    onPress={() => add(product)}
                  >
                    <Ionicons name="cart-outline" size={13} color={brand.textInverse} />
                    <Text style={[styles.addText, { color: brand.textInverse }]}>Add</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {rows.length === 0 ? (
              <Text style={[styles.noSpecs, { color: tokens.textTertiary }]}>
                No published specifications for these products yet.
              </Text>
            ) : (
              rows.map((key, index) => (
                <View
                  key={key}
                  style={[styles.row, { backgroundColor: index % 2 === 0 ? tokens.primarySubtle : tokens.surfaceRaised }]}
                >
                  <View style={[styles.specCol, styles.cell, { borderColor: tokens.border }]}>
                    <Text style={[styles.specKey, { color: tokens.textPrimary }]}>{key}</Text>
                  </View>
                  {products.map((product) => {
                    const value = specs?.[product.id]?.[key]
                    return (
                      <View key={product.id} style={[styles.productCol, styles.cell, { borderColor: tokens.border }]}>
                        <Text style={[styles.specValue, { color: tokens.textSecondary }]}>
                          {value === undefined || value === null || value === "" ? "—" : String(value)}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              ))
            )}
          </ScrollView>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1 },
  crumb: { fontSize: 11 },
  title: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  tagline: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  clear: { fontSize: 13, fontWeight: "800" },
  spinner: { marginTop: spacing.xxl },
  hScroll: { flexGrow: 1 },
  vScroll: { paddingBottom: spacing.xxl },
  headerRow: { flexDirection: "row" },
  row: { flexDirection: "row" },
  specCol: { width: 150 },
  productCol: { width: 170 },
  headCell: { padding: spacing.md, borderWidth: StyleSheet.hairlineWidth },
  cell: { padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center" },
  specHeadText: { fontSize: 13, fontWeight: "800" },
  removeBtn: { position: "absolute", top: 4, right: 4, zIndex: 2, padding: 4 },
  thumb: { width: "100%", height: 72, borderRadius: 6 },
  productName: { fontSize: 11.5, fontWeight: "700", marginTop: spacing.sm, lineHeight: 16 },
  price: { fontSize: 14, fontWeight: "800", marginTop: 4 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 7,
    marginTop: spacing.sm,
  },
  addText: { fontSize: 11.5, fontWeight: "800" },
  specKey: { fontSize: 11.5, fontWeight: "700" },
  specValue: { fontSize: 11.5, lineHeight: 16 },
  noSpecs: { fontSize: 12.5, padding: spacing.xl, textAlign: "center" },
})
