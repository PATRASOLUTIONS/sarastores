import { Ionicons } from "@expo/vector-icons"
import * as WebBrowser from "expo-web-browser"
import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { Notice } from "@/components/AuthShell"
import { StoreHeader } from "@/components/StoreHeader"
import { api, BASE_URL } from "@/api/client"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ContactScreen() {
  const { tokens, brand } = useTheme()
  const { user } = useAuth()

  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: "",
    message: "",
  })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    setError(null)
    if (!form.name.trim()) return setError("Please enter your name")
    if (!EMAIL_RE.test(form.email.trim())) return setError("Please enter a valid email address")
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ""))) {
      return setError("Invalid phone number. Please enter a 10-digit phone number")
    }

    setBusy(true)
    try {
      await api.post("/api/contact-inquiries", {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.replace(/\D/g, ""),
        message: form.message.trim(),
      })
      setSent(true)
      setForm((f) => ({ ...f, message: "" }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your enquiry. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const field = (label: string, key: keyof typeof form, placeholder: string, extra?: object) => (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: tokens.textSecondary }]}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={set(key)}
        placeholder={placeholder}
        placeholderTextColor={tokens.textTertiary}
        style={[
          styles.input,
          { borderColor: tokens.border, backgroundColor: tokens.primarySubtle, color: tokens.textPrimary },
        ]}
        {...extra}
      />
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, { backgroundColor: tokens.primary }]}>
            <Text style={styles.heroTitle}>Contact Us</Text>
            <Text style={styles.heroSub}>
              Questions about a product, an order or a service request? Our team is here to help.
            </Text>
          </View>

          <View style={styles.quickRow}>
            <Pressable
              style={[styles.quick, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
              onPress={() => void Linking.openURL("tel:+918041234567")}
            >
              <Ionicons name="call-outline" size={18} color={tokens.primary} />
              <Text style={[styles.quickText, { color: tokens.textPrimary }]}>Call us</Text>
            </Pressable>
            <Pressable
              style={[styles.quick, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}
              onPress={() => void WebBrowser.openBrowserAsync(`${BASE_URL}/faq`)}
            >
              <Ionicons name="help-circle-outline" size={18} color={tokens.primary} />
              <Text style={[styles.quickText, { color: tokens.textPrimary }]}>Help & FAQs</Text>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>Send us a message</Text>

            {sent ? (
              <Notice
                kind="success"
                title="Thank you!"
                message="We've received your enquiry and will get back to you shortly."
              />
            ) : null}
            {error ? <Notice kind="error" message={error} /> : null}

            {field("Your name", "name", "Full name", { autoComplete: "name" })}
            {field("Email address", "email", "you@example.com", {
              autoCapitalize: "none",
              keyboardType: "email-address",
              autoComplete: "email",
            })}
            {field("Phone number", "phone", "10-digit mobile number", {
              keyboardType: "phone-pad",
              maxLength: 10,
              autoComplete: "tel",
            })}

            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: tokens.textSecondary }]}>How can we help?</Text>
              <TextInput
                value={form.message}
                onChangeText={set("message")}
                placeholder="Tell us a little about what you need"
                placeholderTextColor={tokens.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.textarea,
                  { borderColor: tokens.border, backgroundColor: tokens.primarySubtle, color: tokens.textPrimary },
                ]}
              />
            </View>

            <Pressable
              style={[styles.button, { backgroundColor: tokens.accent }, busy && styles.disabled]}
              onPress={() => void submit()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={brand.textInverse} />
              ) : (
                <Text style={[styles.buttonText, { color: brand.textInverse }]}>Send enquiry</Text>
              )}
            </Pressable>
          </View>

          <Pressable
            style={[styles.linkRow, { borderColor: tokens.border }]}
            onPress={() => void WebBrowser.openBrowserAsync(`${BASE_URL}/complaints`)}
          >
            <Ionicons name="alert-circle-outline" size={17} color={tokens.primary} />
            <Text style={[styles.linkText, { color: tokens.textPrimary }]}>Raise a complaint about an order</Text>
            <Ionicons name="open-outline" size={15} color={tokens.textTertiary} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  hero: { margin: spacing.lg, padding: spacing.xl, borderRadius: 14 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: spacing.sm, lineHeight: 18 },
  quickRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  quick: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickText: { fontSize: 13, fontWeight: "700" },
  card: { margin: spacing.lg, padding: spacing.lg, borderRadius: 12, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: spacing.lg },
  fieldWrap: { marginBottom: spacing.md },
  label: { fontSize: 12.5, fontWeight: "700", marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: 14 },
  textarea: { height: 104 },
  button: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: spacing.xs },
  buttonText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
})
