import { Ionicons } from "@expo/vector-icons"
import * as WebBrowser from "expo-web-browser"
import { useRouter, type Href } from "expo-router"
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native"
import { StoreHeader } from "@/components/StoreHeader"
import { BASE_URL } from "@/api/client"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

type Entry =
  | { label: string; icon?: keyof typeof Ionicons.glyphMap; route: Href }
  | { label: string; icon?: keyof typeof Ionicons.glyphMap; web: string }
  | { label: string; icon?: keyof typeof Ionicons.glyphMap; search: string }

interface Group {
  title: string
  entries: Entry[]
}

// Mirrors the website footer, which is the canonical site map.
const GROUPS: Group[] = [
  {
    title: "Shop by category",
    entries: [
      { label: "Air Conditioners", search: "AIR CONDITIONERS", icon: "snow-outline" },
      { label: "Air Cooler", search: "AIR COOLER", icon: "thermometer-outline" },
      { label: "Dishwasher", search: "DISHWASHER", icon: "water-outline" },
      { label: "Refrigerator", search: "REFRIGERATOR", icon: "cube-outline" },
      { label: 'TV 32"', search: 'TV 32"', icon: "tv-outline" },
      { label: 'TV 43"', search: 'TV 43"', icon: "tv-outline" },
    ],
  },
  {
    title: "Quick links",
    entries: [
      { label: "Brands", route: "/brands", icon: "pricetags-outline" },
      { label: "Offers", route: "/offers", icon: "gift-outline" },
      { label: "New Arrivals", route: "/(tabs)/search", icon: "sparkles-outline" },
      { label: "Track Order", route: "/track", icon: "navigate-outline" },
      { label: "Compare Products", route: "/compare", icon: "git-compare-outline" },
    ],
  },
  {
    title: "Customer service",
    entries: [
      { label: "Returns & Refunds", web: "/returns", icon: "return-down-back-outline" },
      { label: "EMI Options", web: "/emi", icon: "card-outline" },
      { label: "Shipping Policy", web: "/shipping-policy", icon: "rocket-outline" },
      { label: "Warranty", web: "/warranty", icon: "shield-checkmark-outline" },
      { label: "Installation Support", web: "/installation", icon: "construct-outline" },
      { label: "Help & FAQs", web: "/faq", icon: "help-circle-outline" },
      { label: "Contact Us", route: "/contact", icon: "chatbubble-ellipses-outline" },
    ],
  },
  {
    title: "Company",
    entries: [
      { label: "Our Story", web: "/about", icon: "business-outline" },
      { label: "Our Stores", route: "/store-locator", icon: "storefront-outline" },
      { label: "Careers", web: "/careers", icon: "briefcase-outline" },
      { label: "Business Enquiries", web: "/business-enquiries", icon: "mail-outline" },
      { label: "Press & Media", web: "/press", icon: "newspaper-outline" },
      { label: "Blog / Buying Guides", web: "/blog", icon: "book-outline" },
      { label: "Corporate Information", web: "/corporate-information", icon: "document-text-outline" },
    ],
  },
  {
    title: "Legal",
    entries: [
      { label: "Terms & Conditions", web: "/terms-and-conditions" },
      { label: "Privacy Policy", web: "/privacy-policy" },
      { label: "Cancellation Policy", web: "/cancellation-policy" },
      { label: "Return Policy", web: "/returns" },
      { label: "Disclaimer", web: "/disclaimer" },
    ],
  },
]

export default function MenuScreen() {
  const { tokens } = useTheme()
  const router = useRouter()

  // Legal and editorial copy stays on the website so the app can never ship stale terms.
  const openWeb = (path: string) => void WebBrowser.openBrowserAsync(`${BASE_URL}${path}`)

  const press = (entry: Entry) => {
    if ("route" in entry) router.push(entry.route)
    else if ("search" in entry) router.push({ pathname: "/(tabs)/search", params: { q: entry.search } })
    else openWeb(entry.web)
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: tokens.textPrimary }]}>Menu</Text>

        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={[styles.groupTitle, { color: tokens.textTertiary }]}>{group.title.toUpperCase()}</Text>
            <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
              {group.entries.map((entry, i) => (
                <Pressable
                  key={entry.label}
                  style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}
                  onPress={() => press(entry)}
                >
                  {entry.icon ? (
                    <Ionicons name={entry.icon} size={18} color={tokens.primary} />
                  ) : (
                    <View style={styles.iconSpacer} />
                  )}
                  <Text style={[styles.label, { color: tokens.textPrimary }]}>{entry.label}</Text>
                  <Ionicons
                    name={"web" in entry ? "open-outline" : "chevron-forward"}
                    size={15}
                    color={tokens.textTertiary}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.footnote, { color: tokens.textTertiary }]}>
          Sara Electronics · Happier Homes, Brighter Lives
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  pageTitle: { fontSize: 19, fontWeight: "800", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  group: { marginTop: spacing.lg },
  groupTitle: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  card: { marginHorizontal: spacing.lg, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 13 },
  iconSpacer: { width: 18 },
  label: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  footnote: { fontSize: 11, textAlign: "center", marginTop: spacing.xxl },
})
