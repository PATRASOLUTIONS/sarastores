import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { PaymentCancelledError, placeOrder, type CheckoutCustomer } from "@/api/checkout"
import { SignInRequired } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { useAuth } from "@/auth/context"
import { useCart } from "@/cart/context"
import { useTheme } from "@/theme/ThemeContext"
import { formatInr, spacing } from "@/theme/tokens"

type Field = keyof CheckoutCustomer

const FIELDS: { key: Field; label: string; keyboard?: "default" | "email-address" | "phone-pad" | "number-pad"; half?: boolean }[] = [
  { key: "firstName", label: "First name", half: true },
  { key: "lastName", label: "Last name", half: true },
  { key: "email", label: "Email address", keyboard: "email-address" },
  { key: "phone", label: "Phone number", keyboard: "phone-pad" },
  { key: "address", label: "Address" },
  { key: "city", label: "City", half: true },
  { key: "state", label: "State", half: true },
  { key: "zipCode", label: "PIN code", keyboard: "number-pad" },
]

export default function CheckoutScreen() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { items, subtotal, clear } = useCart()
  const { tokens, brand } = useTheme()

  const [customer, setCustomer] = useState<CheckoutCustomer>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  })
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cash">("online")
  const [busy, setBusy] = useState(false)

  // Signing in happens from this screen, so `user` is usually null when the
  // state above is initialised. Fill in what we learn, without overwriting typing.
  useEffect(() => {
    if (!user) return
    setCustomer((prev) => ({
      ...prev,
      firstName: prev.firstName || user.name?.split(" ")[0] || "",
      lastName: prev.lastName || user.name?.split(" ").slice(1).join(" ") || "",
      email: prev.email || user.email || "",
      phone: prev.phone || user.phone || "",
    }))
  }, [user])

  const missing = FIELDS.filter((f) => !customer[f.key]?.trim()).map((f) => f.label)
  const canSubmit = missing.length === 0 && items.length > 0 && !busy

  const submit = async () => {
    setBusy(true)
    try {
      const result = await placeOrder({ items, customer, paymentMethod })
      clear()
      router.replace({ pathname: "/order-confirmed", params: { orderId: result.orderId } })
    } catch (error) {
      if (error instanceof PaymentCancelledError) {
        Alert.alert("Payment cancelled", "No order was placed and you have not been charged.")
      } else {
        Alert.alert("Couldn't place order", error instanceof Error ? error.message : "Please try again.")
      }
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface }}>
        <StoreHeader />
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      </View>
    )
  }

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface }}>
        <StoreHeader />
        <SignInRequired title="Sign in to check out" message="We'll keep your cart while you sign in." />
      </View>
    )
  }

  const inputStyle = {
    borderColor: tokens.border,
    backgroundColor: tokens.primarySubtle,
    color: tokens.textPrimary,
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[styles.pageTitle, { color: tokens.textPrimary }]}>Checkout</Text>

          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Delivery details</Text>
            <View style={styles.fieldGrid}>
              {FIELDS.map((field) => (
                <TextInput
                  key={field.key}
                  value={customer[field.key]}
                  onChangeText={(value) => setCustomer((prev) => ({ ...prev, [field.key]: value }))}
                  placeholder={field.label}
                  placeholderTextColor={tokens.textTertiary}
                  keyboardType={field.keyboard ?? "default"}
                  autoCapitalize={field.key === "email" ? "none" : "words"}
                  style={[styles.input, inputStyle, field.half && styles.half]}
                />
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Payment method</Text>
            {(
              [
                { key: "online", label: "Pay online", note: "UPI, card, net banking, wallets" },
                { key: "cash", label: "Cash on delivery", note: "Pay when your order arrives" },
              ] as const
            ).map((option) => (
              <Pressable
                key={option.key}
                style={[
                  styles.option,
                  { borderColor: paymentMethod === option.key ? tokens.primary : tokens.border },
                ]}
                onPress={() => setPaymentMethod(option.key)}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: paymentMethod === option.key ? tokens.accent : tokens.borderHover },
                    paymentMethod === option.key && { backgroundColor: tokens.accent },
                  ]}
                />
                <View style={styles.flex}>
                  <Text style={[styles.optionLabel, { color: tokens.textPrimary }]}>{option.label}</Text>
                  <Text style={[styles.optionNote, { color: tokens.textTertiary }]}>{option.note}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Order summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: tokens.textSecondary }]}>
                Items ({items.length})
              </Text>
              <Text style={[styles.summaryValue, { color: tokens.textPrimary }]}>{formatInr(subtotal)}</Text>
            </View>
            <View style={styles.noteRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={tokens.success} />
              <Text style={[styles.footnote, { color: tokens.textTertiary }]}>
                GST, delivery and any coupon are calculated by our server before payment.
              </Text>
            </View>
          </View>

          {missing.length > 0 ? (
            <Text style={[styles.missing, { color: tokens.warning }]}>Still needed: {missing.join(", ")}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.actionBar, { backgroundColor: tokens.surfaceRaised, borderTopColor: tokens.border }]}>
          <View>
            <Text style={[styles.barLabel, { color: tokens.textTertiary }]}>Items subtotal</Text>
            <Text style={[styles.barValue, { color: tokens.textPrimary }]}>{formatInr(subtotal)}</Text>
          </View>
          <Pressable
            style={[styles.primary, { backgroundColor: tokens.accent }, !canSubmit && styles.disabled]}
            onPress={submit}
            disabled={!canSubmit}
          >
            {busy ? (
              <ActivityIndicator color={brand.textInverse} />
            ) : (
              <Text style={[styles.primaryText, { color: brand.textInverse }]}>
                {paymentMethod === "online" ? "Pay Now" : "Place Order"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  spinner: { marginTop: spacing.xxl },
  pageTitle: { fontSize: 20, fontWeight: "800" },
  card: { padding: spacing.lg, borderRadius: 12, borderWidth: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: spacing.md },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    fontSize: 14,
  },
  half: { width: "48.5%" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  optionLabel: { fontSize: 14, fontWeight: "700" },
  optionNote: { fontSize: 11.5, marginTop: 1 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13.5 },
  summaryValue: { fontSize: 15, fontWeight: "800" },
  noteRow: { flexDirection: "row", gap: 6, marginTop: spacing.md, alignItems: "flex-start" },
  footnote: { fontSize: 11, flex: 1, lineHeight: 15 },
  missing: { fontSize: 12 },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  barLabel: { fontSize: 11 },
  barValue: { fontSize: 18, fontWeight: "800" },
  primary: { paddingHorizontal: spacing.xxl, paddingVertical: 13, borderRadius: 10 },
  primaryText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.45 },
})
