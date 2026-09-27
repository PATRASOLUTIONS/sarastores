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
import { StoreHeader } from "@/components/StoreHeader"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

export default function LoginScreen() {
  const { signIn } = useAuth()
  const { tokens, brand } = useTheme()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
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
            <Text style={[styles.heading, { color: tokens.textPrimary }]}>Welcome back</Text>
            <Text style={[styles.sub, { color: tokens.textSecondary }]}>
              Sign in to track orders and check out faster.
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={tokens.textTertiary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={[styles.input, { borderColor: tokens.border, backgroundColor: tokens.primarySubtle, color: tokens.textPrimary }]}
            />

            <View
              style={[styles.input, styles.passwordRow, { borderColor: tokens.border, backgroundColor: tokens.primarySubtle }]}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={tokens.textTertiary}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                style={[styles.passwordField, { color: tokens.textPrimary }]}
                onSubmitEditing={() => canSubmit && void submit()}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Text style={[styles.toggle, { color: tokens.primary }]}>{showPassword ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>

            <Pressable style={styles.forgot} onPress={() => router.push("/forgot-password")} hitSlop={6}>
              <Text style={[styles.forgotText, { color: tokens.primary }]}>Forgot password?</Text>
            </Pressable>

            {error ? <Text style={[styles.error, { color: brand.danger }]}>{error}</Text> : null}

            <Pressable
              style={[styles.button, { backgroundColor: tokens.accent }, !canSubmit && styles.disabled]}
              onPress={() => void submit()}
              disabled={!canSubmit}
            >
              {busy ? (
                <ActivityIndicator color={brand.textInverse} />
              ) : (
                <Text style={[styles.buttonText, { color: brand.textInverse }]}>Sign In</Text>
              )}
            </Pressable>

            <Pressable style={styles.switch} onPress={() => router.replace("/register")}>
              <Text style={[styles.switchText, { color: tokens.primary }]}>
                New to SARA? Create an account
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.legal, { color: tokens.textTertiary }]}>
            By signing in you agree to our Terms and Privacy Policy.
          </Text>
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
  passwordRow: { flexDirection: "row", alignItems: "center", paddingVertical: 0 },
  passwordField: { flex: 1, fontSize: 14, paddingVertical: 12 },
  toggle: { fontSize: 12.5, fontWeight: "700" },
  forgot: { alignSelf: "flex-end", marginBottom: spacing.md },
  forgotText: { fontSize: 12.5, fontWeight: "700" },
  error: { marginBottom: spacing.md, fontSize: 12.5 },
  button: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: spacing.xs },
  buttonText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.45 },
  switch: { marginTop: spacing.lg, alignItems: "center" },
  switchText: { fontWeight: "700", fontSize: 13 },
  legal: { fontSize: 11, textAlign: "center", marginTop: spacing.lg },
})
