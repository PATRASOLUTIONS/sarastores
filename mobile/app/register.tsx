import { useRouter } from "expo-router"
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
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canSubmit = name.trim().length > 1 && email.includes("@") && password.length >= 8 && !busy

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await signup(name.trim(), email.trim(), password)
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
  container: { padding: spacing.lg, paddingTop: spacing.xl },
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
  error: { marginBottom: spacing.md, fontSize: 12.5 },
  button: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: spacing.xs },
  buttonText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.45 },
  switch: { marginTop: spacing.lg, alignItems: "center" },
  switchText: { fontWeight: "700", fontSize: 13 },
})
