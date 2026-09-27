import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import { fetchWishlist } from "@/api/catalog"
import { ProductCard } from "@/components/ProductCard"
import { EmptyState, SignInRequired } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

export default function WishlistScreen() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { tokens } = useTheme()
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["wishlist"],
    queryFn: fetchWishlist,
    enabled: isAuthenticated,
  })

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <Text style={[styles.pageTitle, { color: tokens.textPrimary }]}>Wishlist</Text>

      {authLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : !isAuthenticated ? (
        <SignInRequired title="Sign in to see your wishlist" message="Save products you like and find them here." />
      ) : isLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : isError ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load your wishlist"
          message="Please try again in a moment."
        />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.column}
          renderItem={({ item }) => <ProductCard product={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="Nothing saved yet"
              message="Tap the heart on any product to save it here."
              actionLabel="Browse products"
              onAction={() => router.push("/(tabs)/search")}
            />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 19, fontWeight: "800", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 },
  column: { paddingHorizontal: spacing.sm },
  spinner: { marginTop: spacing.xxl },
})
