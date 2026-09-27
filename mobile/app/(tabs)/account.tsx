import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SignInRequired } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

const LINKS = [
  { icon: "receipt-outline", label: "My Orders", href: "/orders" },
  { icon: "navigate-outline", label: "Track an Order", href: "/track" },
  { icon: "heart-outline", label: "Wishlist", href: "/wishlist" },
  { icon: "cart-outline", label: "Cart", href: "/(tabs)/cart" },
  { icon: "person-outline", label: "My Profile", href: "/account/profile" },
  { icon: "notifications-outline", label: "Communication preferences", href: "/account/preferences" },
] as const

export default function AccountScreen() {
  const { user, isAuthenticated, isLoading, signOut, deleteAccount } = useAuth()
  const { tokens, brand } = useTheme()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const confirmDelete = () => {
    // Apple 5.1.1(v): deletion must be reachable in-app and must actually delete.
    Alert.alert(
      "Delete account?",
      "This permanently deletes your profile, cart and wishlist. Past orders are kept for tax records but are no longer linked to you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true)
            try {
              await deleteAccount()
              router.replace("/(tabs)")
            } catch (error) {
              Alert.alert("Couldn't delete account", error instanceof Error ? error.message : "Please try again.")
            } finally {
              setBusy(false)
            }
          },
        },
      ],
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : !isAuthenticated ? (
        <SignInRequired
          title="Sign in to your account"
          message="Track orders, save favourites and check out faster."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <View style={[styles.avatar, { backgroundColor: tokens.primarySubtle }]}>
              <Text style={[styles.avatarText, { color: tokens.primary }]}>
                {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.identity}>
              <Text style={[styles.name, { color: tokens.textPrimary }]}>{user?.name}</Text>
              <Text style={[styles.email, { color: tokens.textSecondary }]}>{user?.email}</Text>
            </View>
          </View>

          <View style={[styles.linkCard, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            {LINKS.map((link, index) => (
              <Pressable
                key={link.label}
                style={[styles.link, index > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}
                onPress={() => router.push(link.href)}
              >
                <Ionicons name={link.icon} size={19} color={tokens.primary} />
                <Text style={[styles.linkLabel, { color: tokens.textPrimary }]}>{link.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={tokens.textTertiary} />
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.secondary, { borderColor: tokens.border }]}
            onPress={() => void signOut()}
            disabled={busy}
          >
            <Text style={[styles.secondaryText, { color: tokens.textPrimary }]}>Sign out</Text>
          </Pressable>

          <Pressable style={styles.destructive} onPress={confirmDelete} disabled={busy}>
            <Text style={[styles.destructiveText, { color: brand.danger }]}>
              {busy ? "Deleting…" : "Delete my account"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  spinner: { marginTop: spacing.xxl },
  card: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: 12, borderWidth: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 19, fontWeight: "800" },
  identity: { marginLeft: spacing.lg, flex: 1 },
  name: { fontSize: 16, fontWeight: "800" },
  email: { fontSize: 12.5, marginTop: 2 },
  linkCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  link: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  secondary: { paddingVertical: 13, alignItems: "center", borderRadius: 10, borderWidth: 1 },
  secondaryText: { fontWeight: "700", fontSize: 14 },
  destructive: { paddingVertical: spacing.md, alignItems: "center" },
  destructiveText: { fontWeight: "700", fontSize: 13 },
})
