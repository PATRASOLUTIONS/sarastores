import { useRouter } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { AuthShell, Notice } from "@/components/AuthShell"
import { api } from "@/api/client"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordScreen() {
  const { tokens, brand } = useTheme()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    setError(null)
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address")
      return
    }
    setBusy(true)
    try {
      await api.post("/api/auth/forgot-password", { email: email.trim().toLowerCase() })
      setSent(true)
      setEmail("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      icon="mail-outline"
      title="Forgot Password?"
      subtitle="No worries! Enter your email and we'll send you reset instructions."
    >
      {sent ? (
        <Notice
          kind="success"
          title="Email sent successfully!"
          message="If an account exists with this email, you will receive password reset instructions shortly. Please check your inbox and spam folder."
        />
      ) : null}
      {error ? <Notice kind="error" message={error} /> : null}

      <Text style={[styles.label, { color: tokens.textSecondary }]}>Email address</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={tokens.textTertiary}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onSubmitEditing={() => void submit()}
        style={[
          styles.input,
          { borderColor: tokens.border, backgroundColor: tokens.primarySubtle, color: tokens.textPrimary },
        ]}
      />

      <Pressable
        style={[styles.button, { backgroundColor: tokens.accent }, busy && styles.disabled]}
        onPress={() => void submit()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={brand.textInverse} />
        ) : (
          <Text style={[styles.buttonText, { color: brand.textInverse }]}>Send Reset Link</Text>
        )}
      </Pressable>

      <Pressable style={styles.back} onPress={() => router.replace("/login")}>
        <Text style={[styles.backText, { color: tokens.primary }]}>← Back to Login</Text>
      </Pressable>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: "700", marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginBottom: spacing.lg,
    fontSize: 14,
  },
  button: { paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  buttonText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
  back: { marginTop: spacing.lg, alignItems: "center" },
  backText: { fontWeight: "700", fontSize: 13 },
})
