"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Bell, Loader2, Mail, MessageCircle, Smartphone, ShieldCheck } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { formatPrice } from "@/utils/formatPrice"

type Consent = { email: boolean; whatsapp: boolean; sms: boolean }

type Profile = {
  tier?: string
  lifetimeSpend?: number
  orderCount?: number
  categoriesBought?: string[]
  consent?: Consent
}

const CHANNELS: Array<{
  key: keyof Consent
  icon: typeof Mail
  label: string
  description: string
}> = [
  { key: "email", icon: Mail, label: "Email", description: "Offers, price drops and new arrivals" },
  { key: "whatsapp", icon: MessageCircle, label: "WhatsApp", description: "Deal alerts and service reminders" },
  { key: "sms", icon: Smartphone, label: "SMS", description: "Occasional time-sensitive offers" },
]

const TIER_LABEL: Record<string, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
}

export default function PreferencesClient() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [consent, setConsent] = useState<Consent>({ email: false, whatsapp: false, sms: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<keyof Consent | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch("/api/account/preferences")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return
        setProfile(data.profile)
        if (data.profile?.consent) setConsent(data.profile.consent)
      })
      .catch(() => toast.error("Could not load your preferences"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async (channel: keyof Consent) => {
    const next = !consent[channel]
    setConsent((c) => ({ ...c, [channel]: next }))
    setSaving(channel)
    try {
      const res = await apiFetch("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [channel]: next }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Update failed")
      toast.success(next ? "Subscribed" : "Unsubscribed")
    } catch {
      // Roll the switch back so the UI never claims a preference we failed to save.
      setConsent((c) => ({ ...c, [channel]: !next }))
      toast.error("Could not save that change")
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-brand-text-tertiary">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const tier = TIER_LABEL[profile?.tier ?? "silver"] ?? "Silver"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Communication preferences</h1>
        <p className="mt-1 text-sm text-brand-text-secondary">
          Choose how you&apos;d like to hear from Sara. You can change this at any time.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-text-tertiary">Membership</p>
          <p className="mt-1 text-xl font-bold text-brand-text-primary">{tier}</p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-text-tertiary">Orders</p>
          <p className="mt-1 text-xl font-bold text-brand-text-primary">{profile?.orderCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-text-tertiary">Total spent</p>
          <p className="mt-1 text-xl font-bold text-brand-text-primary">
            {formatPrice(profile?.lifetimeSpend ?? 0)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
        <div className="flex items-center gap-2 border-b border-brand-border px-5 py-4">
          <Bell className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-bold text-brand-text-primary">Marketing messages</h2>
        </div>

        <ul>
          {CHANNELS.map(({ key, icon: Icon, label, description }) => (
            <li
              key={key}
              className="flex items-center justify-between gap-4 border-b border-brand-border px-5 py-4 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-brand-primary-light text-brand-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-text-primary">{label}</p>
                  <p className="text-xs text-brand-text-tertiary">{description}</p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={consent[key]}
                aria-label={`${consent[key] ? "Disable" : "Enable"} ${label} messages`}
                disabled={saving === key}
                onClick={() => toggle(key)}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  consent[key] ? "bg-brand-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    consent[key] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-start gap-2 text-xs text-brand-text-tertiary">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-success" />
        We&apos;ll always email you about your own orders and deliveries — those are service messages,
        not marketing, and they aren&apos;t affected by these settings.
      </p>
    </div>
  )
}
