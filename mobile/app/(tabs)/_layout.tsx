import { Ionicons } from "@expo/vector-icons"
import { Tabs } from "expo-router"
import { useCart } from "@/cart/context"
import { useTheme } from "@/theme/ThemeContext"

export default function TabsLayout() {
  const { count } = useCart()
  const { tokens, brand } = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tokens.primary,
        tabBarInactiveTintColor: tokens.textTertiary,
        headerShown: false,
        tabBarStyle: { borderTopColor: tokens.border, backgroundColor: tokens.surfaceRaised },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarLabel: "Search",
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          tabBarLabel: "Cart",
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: brand.danger, fontSize: 10 },
          tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          tabBarLabel: "Account",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
