import { useLocalSearchParams, useRouter } from "expo-router"
import { useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { AuthShell, Notice } from "@/components/AuthShell"
import { api } from "@/api/client"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

// Mirrors app/reset-password/page.tsx so the app can't accept a password the web API rejects.
function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return "Password must be at least 8 characters long"
  if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter"
  if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter"
  if (!/[0-9]/.test(pwd)) return "Password must contain at least one number"
  return null
}

function strengthOf(pwd: string): number {
  let s = 0
  if (pwd.length >= 8) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[a-z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  return s
}

const STRENGTH_LABEL = ["", "Very weak", "Weak", "Fair", "Good", "Strong"]
const STRENGTH_COLOR = ["#E5E7EB", "#DC2626", "#F97316", "#EAB308", "#22C55E", "#15803D"]

export default function ResetPasswordScreen() {
  const { tokens, brand } = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ token?: string }>()
  const token = typeof params.token === "string" ? params.token : undefined

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const strength = useMemo(() => strengthOf(password), [password])

  const submit = async () => {
    setError(null)
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.")
      return
    }
    if (!password || !confirm) {
      setError("Please fill in all fields")
      return
    }
    const bad = validatePassword(password)
    if (bad) {
      setError(bad)
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setBusy(true)
    try {
      await api.post("/api/auth/reset-password", { token, password })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AuthShell
        icon="checkmark-circle-outline"
        title="Password Reset!"
        subtitle="Your password has been changed successfully."
      >
        <Notice kind="success" message="You can now sign in with your new password." />
        <Pressable style={[styles.button, { backgroundColor: tokens.accent }]} onPress={() => router.replace("/login")}>
          <Text style={[styles.buttonText, { color: brand.textInverse }]}>Go to Sign In</Text>
        </Pressable>
      </AuthShell>
    )
  }

  return (
    <AuthShell icon="key-outline" title="Reset Password" subtitle="Choose a strong new password for your account.">
      {!token ? (
        <Notice kind="error" message="Invalid reset link. Please request a new password reset." />
      ) : null}
      {error ? <Notice kind="error" message={error} /> : null}

      <Text style={[styles.label, { color: tokens.textSecondary }]}>New password</Text>
      <View
        style={[styles.input, styles.row, { borderColor: tokens.border, backgroundColor: tokens.primarySubtle }]}
      >
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Enter new password"
          placeholderTextColor={tokens.textTertiary}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="new-password"
          style={[styles.field, { color: tokens.textPrimary }]}
        />
        <Pressable onPress={() => setShow((v) => !v)} hitSlop={8}>
          <Text style={[styles.toggle, { color: tokens.primary }]}>{show ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>

      {password.length > 0 ? (
        <View style={styles.strengthWrap}>
          <View style={styles.bars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[styles.bar, { backgroundColor: i <= strength ? STRENGTH_COLOR[strength] : "#E5E7EB" }]}
              />
            ))}
          </View>
          <Text style={[styles.strengthText, { color: STRENGTH_COLOR[strength] }]}>{STRENGTH_LABEL[strength]}</Text>
        </View>
      ) : null}

      <Text style={[styles.label, { color: tokens.textSecondary }]}>Confirm password</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Re-enter new password"
        placeholderTextColor={tokens.textTertiary}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="new-password"
        onSubmitEditing={() => void submit()}
        style={[
          styles.input,
          { borderColor: tokens.border, backgroundColor: tokens.primarySubtle, color: tokens.textPrimary },
        ]}
      />

      <Text style={[styles.hint, { color: tokens.textTertiary }]}>
        Must be 8+ characters with an uppercase letter, a lowercase letter and a number.
      </Text>

      <Pressable
        style={[styles.button, { backgroundColor: tokens.accent }, (busy || !token) && styles.disabled]}
        onPress={() => void submit()}
        disabled={busy || !token}
      >
        {busy ? (
          <ActivityIndicator color={brand.textInverse} />
        ) : (
          <Text style={[styles.buttonText, { color: brand.textInverse }]}>Reset Password</Text>
        )}
      </Pressable>

      <Pressable style={styles.back} onPress={() => router.replace("/forgot-password")}>
        <Text style={[styles.backText, { color: tokens.primary }]}>Request a new link</Text>
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
    marginBottom: spacing.md,
    fontSize: 14,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 0 },
  field: { flex: 1, fontSize: 14, paddingVertical: 12 },
  toggle: { fontSize: 12.5, fontWeight: "700" },
  strengthWrap: { marginBottom: spacing.md },
  bars: { flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  strengthText: { fontSize: 11, fontWeight: "700", marginTop: 5 },
  hint: { fontSize: 11, lineHeight: 16, marginBottom: spacing.lg },
  button: { paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  buttonText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
  back: { marginTop: spacing.lg, alignItems: "center" },
  backText: { fontWeight: "700", fontSize: 13 },
})
