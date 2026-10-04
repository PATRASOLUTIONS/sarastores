import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Notice } from "@/components/AuthShell"
import { SignInRequired } from "@/components/States"
import { StoreHeader } from "@/components/StoreHeader"
import { apiRequest } from "@/api/client"
import { useAuth } from "@/auth/context"
import { useTheme } from "@/theme/ThemeContext"
import { spacing } from "@/theme/tokens"

interface UserRecord {
  id: string
  name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
}

export default function ProfileScreen() {
  const { user, isAuthenticated, isLoading, refresh } = useAuth()
  const { tokens, brand } = useTheme()

  const [form, setForm] = useState({ name: "", phone: "", address: "", city: "", state: "", zipCode: "" })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The session payload only carries id/email/role, so the full record is fetched here.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    apiRequest<UserRecord>(`/api/users/${encodeURIComponent(user.id)}`, { auth: true })
      .then((record) => {
        if (cancelled) return
        setForm({
          name: record.name ?? "",
          phone: record.phone ?? "",
          address: record.address ?? "",
          city: record.city ?? "",
          state: record.state ?? "",
          zipCode: record.zipCode ?? "",
        })
      })
      .catch(() => {
        if (!cancelled) setForm((f) => ({ ...f, name: user.name ?? "" }))
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.name])

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  const save = async () => {
    if (!user?.id) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await apiRequest(`/api/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        auth: true,
        body: form,
      })
      setSaved(true)
      await refresh?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.")
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
      <Text style={[styles.pageTitle, { color: tokens.textPrimary }]}>My Profile</Text>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.primary} />
      ) : !isAuthenticated ? (
        <SignInRequired title="Sign in to edit your profile" message="Your name, phone and address live here." />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: tokens.surfaceRaised, borderColor: tokens.border }]}>
            {saved ? <Notice kind="success" message="Profile updated successfully!" /> : null}
            {error ? <Notice kind="error" message={error} /> : null}

            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: tokens.textSecondary }]}>Email address</Text>
              <View style={[styles.input, styles.readonly, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                <Text style={[styles.readonlyText, { color: tokens.textSecondary }]}>{user?.email}</Text>
              </View>
              <Text style={[styles.hint, { color: tokens.textTertiary }]}>
                Your email is used to sign in and can&apos;t be changed here.
              </Text>
            </View>

            {field("Full name", "name", "Your full name", { autoComplete: "name" })}
            {field("Phone number", "phone", "10-digit mobile number", {
              keyboardType: "phone-pad",
              autoComplete: "tel",
              maxLength: 10,
            })}
            {field("Address", "address", "House no., street, area", { multiline: true })}

            <View style={styles.row}>
              <View style={styles.half}>{field("City", "city", "City")}</View>
              <View style={styles.half}>{field("State", "state", "State")}</View>
            </View>

            {field("PIN code", "zipCode", "560001", { keyboardType: "number-pad", maxLength: 6 })}

            <Pressable
              style={[styles.button, { backgroundColor: tokens.accent }, busy && styles.disabled]}
              onPress={() => void save()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={brand.textInverse} />
              ) : (
                <Text style={[styles.buttonText, { color: brand.textInverse }]}>Save changes</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 19, fontWeight: "800", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  spinner: { marginTop: spacing.xxl },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: { borderRadius: 12, borderWidth: 1, padding: spacing.lg },
  fieldWrap: { marginBottom: spacing.md },
  label: { fontSize: 12.5, fontWeight: "700", marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: 14 },
  readonly: { justifyContent: "center" },
  readonlyText: { fontSize: 14 },
  hint: { fontSize: 11, marginTop: 4 },
  row: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  button: { paddingVertical: 13, borderRadius: 10, alignItems: "center", marginTop: spacing.sm },
  buttonText: { fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.5 },
})
