import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { signup } from "@/api/auth"
import { BASE_URL } from "@/api/client"
import { StoreHeader } from "@/components/StoreHeader"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

export default function RegisterScreen() {
  const { signIn } = useAuth()
  const { tokens, brand } = useTheme()
  const router = useRouter()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacyNotice, setAcceptPrivacyNotice] = useState(false)
  const [marketingEmail, setMarketingEmail] = useState(false)
  const [marketingWhatsapp, setMarketingWhatsapp] = useState(false)
  const [marketingSms, setMarketingSms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canSubmit =
    name.trim().length > 1 &&
    email.includes("@") &&
    password.length >= 8 &&
    acceptTerms &&
    acceptPrivacyNotice &&
    !busy

  const openWeb = (path: string) => void WebBrowser.openBrowserAsync(`${BASE_URL}${path}`)

  const submit = async () => {
    setError(null)

    setBusy(true)
    try {
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        acceptTerms: true,
        acceptPrivacyNotice: true,
        marketingEmail,
        marketingWhatsapp,
        marketingSms,
      })
      // Sign in straight away so the shopper isn't bounced to their inbox
      // mid-purchase; verification is enforced where it actually matters.
      await signIn(email.trim(), password)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account")
    } finally {
      setBusy(false)
    }
  }

  const checkbox = (
    checked: boolean,
    toggle: () => void,
    content: React.ReactNode,
    key?: string,
  ) => (
    <Pressable
      key={key}
      style={styles.checkRow}
      onPress={toggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={20}
        color={checked ? tokens.primary : tokens.textTertiary}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1 }}>{content}</View>
    </Pressable>
  )

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <StoreHeader />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            <Text style={[styles.heading, { color: tokens.textPrimary }]}>Create your account</Text>
            <Text style={[styles.sub, { color: tokens.textSecondary }]}>
              It takes a minute and makes checkout much faster.
            </Text>

            {[
              { value: name, set: setName, placeholder: "Full name", auto: "name" as const },
              { value: email, set: setEmail, placeholder: "Email address", auto: "email" as const },
            ].map((field) => (
              <TextInput
                key={field.placeholder}
                value={field.value}
                onChangeText={field.set}
                placeholder={field.placeholder}
                placeholderTextColor={tokens.textTertiary}
                autoCapitalize={field.auto === "email" ? "none" : "words"}
                keyboardType={field.auto === "email" ? "email-address" : "default"}
                style={[
                  styles.input,
                  { borderColor: tokens.border, backgroundColor: tokens.primarySubtle, color: tokens.textPrimary },
                ]}
              />
            ))}

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password (min 8 characters)"
              placeholderTextColor={tokens.textTertiary}
              secureTextEntry
              style={[
                styles.input,
                { borderColor: tokens.border, backgroundColor: tokens.primarySubtle, color: tokens.textPrimary },
              ]}
            />

            {/*
              Section 5 notice. The Act requires the person to be told what is
              collected and why *before* consenting, not to go hunting for it.
            */}
            <View style={[styles.notice, { borderColor: tokens.border, backgroundColor: tokens.primarySubtle }]}>
              <Text style={[styles.noticeTitle, { color: tokens.textPrimary }]}>How we use your details</Text>
              <Text style={[styles.noticeBody, { color: tokens.textSecondary }]}>
                We collect your name and email address and, later at checkout, your phone number and delivery address,
                so we can create your account, process your orders and issue GST invoices. We keep invoice records for
                72 months because tax law requires it. You can access, correct, export or erase your data, withdraw
                consent at any time, or complain to the Data Protection Board of India.
              </Text>
              <Pressable onPress={() => openWeb("/privacy-policy")}>
                <Text style={[styles.link, { color: tokens.primary }]}>Read the full privacy notice</Text>
              </Pressable>
            </View>

            {checkbox(
              acceptTerms,
              () => setAcceptTerms((v) => !v),
              <Text style={[styles.checkText, { color: tokens.textSecondary }]}>
                I agree to the{" "}
                <Text
                  style={[styles.link, { color: tokens.primary }]}
                  onPress={() => openWeb("/terms-and-conditions")}
                >
                  Terms and Conditions
                </Text>
              </Text>,
            )}

            {checkbox(
              acceptPrivacyNotice,
              () => setAcceptPrivacyNotice((v) => !v),
              <Text style={[styles.checkText, { color: tokens.textSecondary }]}>
                I have read the{" "}
                <Text style={[styles.link, { color: tokens.primary }]} onPress={() => openWeb("/privacy-policy")}>
                  Privacy Notice
                </Text>{" "}
                and consent to my data being processed to run my account and orders
              </Text>,
            )}

            {/*
              Optional and genuinely severable — consent that is a condition of
              getting the service is not "free" under Section 6(1), so these
              default to off and never block submission.
            */}
            <View style={[styles.notice, { borderColor: tokens.border, marginTop: spacing.sm }]}>
              <Text style={[styles.noticeTitle, { color: tokens.textPrimary }]}>Keep me posted (optional)</Text>
              <Text style={[styles.noticeBody, { color: tokens.textSecondary }]}>
                Entirely your choice — your account works exactly the same either way, and you can change this
                whenever you like.
              </Text>
              {[
                {
                  label: "Email me offers, price drops and new arrivals",
                  value: marketingEmail,
                  set: setMarketingEmail,
                },
                { label: "Send me offers on WhatsApp", value: marketingWhatsapp, set: setMarketingWhatsapp },
                { label: "Send me offers by SMS", value: marketingSms, set: setMarketingSms },
              ].map((item) =>
                checkbox(
                  item.value,
                  () => item.set((v) => !v),
                  <Text style={[styles.checkText, { color: tokens.textSecondary }]}>{item.label}</Text>,
                  item.label,
                ),
              )}
            </View>

            {error ? <Text style={[styles.error, { color: brand.danger }]}>{error}</Text> : null}

            <Pressable
              style={[styles.button, { backgroundColor: tokens.accent }, !canSubmit && styles.disabled]}
              onPress={() => void submit()}
              disabled={!canSubmit}
            >
              {busy ? (
                <ActivityIndicator color={brand.textInverse} />
              ) : (
                <Text style={[styles.buttonText, { color: brand.textInverse }]}>Create Account</Text>
              )}
            </Pressable>

            <Pressable style={styles.switch} onPress={() => router.replace("/login")}>
              <Text style={[styles.switchText, { color: tokens.primary }]}>Already have an account? Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  card: { padding: spacing.xl, borderRadius: 14, borderWidth: 1 },
  heading: { fontSize: 22, fontWeight: "800" },
  sub: { fontSize: 13, marginTop: spacing.xs, marginBottom: spacing.xl },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginBottom: spacing.md,
    fontSize: 14,
  },
  notice: { borderWidth: 1, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  noticeTitle: { fontSize: 12.5, fontWeight: "800" },
  noticeBody: { fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  link: { fontWeight: "700", fontSize: 12 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 7 },
  checkText: { fontSize: 12.5, lineHeight: 18 },
  error: { marginBottom: spacing.md, marginTop: spacing.xs, fontSize: 12.5 },
  button: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: spacing.xs },
  buttonText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.45 },
  switch: { marginTop: spacing.lg, alignItems: "center" },
  switchText: { fontWeight: "700", fontSize: 13 },
})
