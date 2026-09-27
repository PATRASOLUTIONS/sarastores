import { useQuery } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import { fetchProducts } from "@/api/catalog"
import { ProductCard } from "@/components/ProductCard"
import { EmptyState } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

export default function CategoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const { tokens } = useTheme()
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", "category", id],
    queryFn: () => fetchProducts({ category: name ?? id, limit: 200 }),
    enabled: !!id,
  })

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />

      <View style={styles.crumbs}>
        <Text style={[styles.crumb, { color: tokens.textTertiary }]}>Home</Text>
        <Text style={[styles.crumb, { color: tokens.textTertiary }]}>/</Text>
        <Text style={[styles.crumbActive, { color: tokens.textPrimary }]}>{name ?? "Category"}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} size="large" />
      ) : isError ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load this category"
          message="Please try again in a moment."
        />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.column}
          ListHeaderComponent={
            <Text style={[styles.count, { color: tokens.textTertiary }]}>
              {(data ?? []).length} product{(data ?? []).length === 1 ? "" : "s"}
            </Text>
          }
          renderItem={({ item }) => <ProductCard product={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="Nothing here yet"
              message="There are no products in this category right now."
              actionLabel="Browse all products"
              onAction={() => router.push("/(tabs)/search")}
            />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  crumbs: { flexDirection: "row", gap: 5, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  crumb: { fontSize: 11.5 },
  crumbActive: { fontSize: 11.5, fontWeight: "700" },
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
  column: { paddingHorizontal: spacing.sm },
  count: { fontSize: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  spinner: { marginTop: spacing.xxl },
})
