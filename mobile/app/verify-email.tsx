import { useLocalSearchParams, useRouter } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native"
import { AuthShell, Notice } from "@/components/AuthShell"
import { api } from "@/api/client"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

type Status = "success" | "already" | "expired" | "invalid" | "error" | "pending"

const COPY: Record<Status, { icon: "checkmark-circle-outline" | "alert-circle-outline" | "time-outline" | "mail-open-outline"; title: string; subtitle: string }> = {
  success: {
    icon: "checkmark-circle-outline",
    title: "Email Verified",
    subtitle: "Thanks for confirming your address. Your account is ready to use.",
  },
  already: {
    icon: "checkmark-circle-outline",
    title: "Already Verified",
    subtitle: "This email address has already been confirmed. You can sign in normally.",
  },
  expired: {
    icon: "time-outline",
    title: "Link Expired",
    subtitle: "That verification link is no longer valid. Request a fresh one below.",
  },
  invalid: {
    icon: "alert-circle-outline",
    title: "Invalid Link",
    subtitle: "We couldn't match that verification link to an account.",
  },
  error: {
    icon: "alert-circle-outline",
    title: "Something Went Wrong",
    subtitle: "We couldn't verify your email just now. Please try again.",
  },
  pending: {
    icon: "mail-open-outline",
    title: "Verify Your Email",
    subtitle: "We've sent a confirmation link to your inbox. Open it to activate your account.",
  },
}

export default function VerifyEmailScreen() {
  const { tokens, brand } = useTheme()
  const { user } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams<{ status?: string }>()

  const raw = typeof params.status === "string" ? params.status : "pending"
  const status: Status = (["success", "already", "expired", "invalid", "error", "pending"] as const).includes(
    raw as Status,
  )
    ? (raw as Status)
    : "pending"

  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copy = COPY[status]
  const canResend = status !== "success" && status !== "already"

  const resend = async () => {
    if (!user?.id) {
      router.push("/login")
      return
    }
    setError(null)
    setBusy(true)
    try {
      await api.post("/api/auth/verify-email", { userId: user.id })
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the verification email.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell icon={copy.icon} title={copy.title} subtitle={copy.subtitle}>
      {resent ? <Notice kind="success" message="Verification email sent. Check your inbox and spam folder." /> : null}
      {error ? <Notice kind="error" message={error} /> : null}

      {canResend ? (
        <Pressable
          style={[styles.button, { backgroundColor: tokens.accent }, busy && styles.disabled]}
          onPress={() => void resend()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={brand.textInverse} />
          ) : (
            <Text style={[styles.buttonText, { color: brand.textInverse }]}>
              {user?.id ? "Resend verification email" : "Sign in to resend"}
            </Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        style={[
          canResend ? styles.secondary : styles.button,
          canResend ? { borderColor: tokens.primary } : { backgroundColor: tokens.accent },
        ]}
        onPress={() => router.replace("/")}
      >
        <Text
          style={[
            canResend ? styles.secondaryText : styles.buttonText,
            { color: canResend ? tokens.primary : brand.textInverse },
          ]}
        >
          Continue shopping
        </Text>
      </Pressable>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  button: { paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  buttonText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
  secondary: { paddingVertical: 12, borderRadius: 10, alignItems: "center", borderWidth: 1.5, marginTop: spacing.md },
  secondaryText: { fontWeight: "800", fontSize: 14 },
})
