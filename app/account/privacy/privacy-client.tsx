"use client"

/**
 * Account → Privacy & your data.
 *
 * One page that lets a Data Principal exercise every right the DPDP Act gives
 * them without contacting support:
 *   s.11      — download everything we hold (and who we share it with)
 *   s.6(4)    — withdraw consent, as easily as it was given
 *   s.12(1)   — correct their details
 *   s.12(3)   — erase their account
 *   s.13      — raise a grievance
 */

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { useRouter } from "next/navigation"
import {
  Download,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Cookie,
  Mail,
  MessageSquare,
  Smartphone,
  FileText,
  Loader2,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/contexts/AuthContext"
import { readConsent, writeConsent, type TrackingConsent } from "@/lib/consent-client"
import { dpdpConfig } from "@/lib/dpdp-config"

type MarketingConsent = { email: boolean; whatsapp: boolean; sms: boolean }

export default function PrivacyCentreClient() {
  const router = useRouter()
  const { logout } = useAuth()

  const [marketing, setMarketing] = useState<MarketingConsent>({ email: false, whatsapp: false, sms: false })
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const [tracking, setTracking] = useState<TrackingConsent | null>(null)

  const [exporting, setExporting] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setTracking(readConsent())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch("/api/account/preferences")
        const json = await res.json()
        if (!cancelled && json?.profile?.consent) {
          setMarketing({
            email: Boolean(json.profile.consent.email),
            whatsapp: Boolean(json.profile.consent.whatsapp),
            sms: Boolean(json.profile.consent.sms),
          })
        }
      } catch {
        // Leave the toggles at "off" — showing consent we cannot verify would
        // be worse than showing none.
      } finally {
        if (!cancelled) setLoadingPrefs(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveMarketing = useCallback(async (next: MarketingConsent) => {
    setSavingPrefs(true)
    const previous = marketing
    setMarketing(next)
    try {
      const res = await apiFetch("/api/account/preferences", {
        method: "PUT",
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error("save failed")
      toast.success("Your choice has been saved.")
    } catch {
      setMarketing(previous)
      toast.error("Could not save that. Please try again.")
    } finally {
      setSavingPrefs(false)
    }
  }, [marketing])

  const saveTracking = useCallback((next: Partial<TrackingConsent>) => {
    const merged = writeConsent({
      analytics: next.analytics ?? tracking?.analytics ?? false,
      advertising: next.advertising ?? tracking?.advertising ?? false,
      personalisation: next.personalisation ?? tracking?.personalisation ?? false,
    })
    setTracking(merged)
    toast.success("Cookie preferences updated.")
  }, [tracking])

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const res = await apiFetch("/api/account/export")
      if (!res.ok) throw new Error("export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `sara-personal-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success("Your data has been downloaded.")
    } catch {
      toast.error("Could not generate your export. Please try again or contact our Grievance Officer.")
    } finally {
      setExporting(false)
    }
  }, [])

  const handleDelete = useCallback(async () => {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      toast.error('Please type DELETE to confirm.')
      return
    }
    setDeleting(true)
    try {
      const res = await apiFetch("/api/v1/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || "Could not delete your account.")
        setDeleting(false)
        return
      }
      toast.success("Your account has been deleted.")
      try {
        await logout()
      } catch {
        // The server already cleared the cookie; a failed client logout is cosmetic.
      }
      router.push("/")
    } catch {
      toast.error("Could not delete your account. Please try again.")
      setDeleting(false)
    }
  }, [deleteConfirm, deletePassword, logout, router])

  const marketingRows: Array<{ key: keyof MarketingConsent; label: string; hint: string; icon: ReactNode }> = [
    { key: "email", label: "Email", hint: "Offers, new arrivals and price drops by email.", icon: <Mail className="h-4 w-4" /> },
    { key: "whatsapp", label: "WhatsApp", hint: "Promotional messages on WhatsApp.", icon: <MessageSquare className="h-4 w-4" /> },
    { key: "sms", label: "SMS", hint: "Promotional text messages.", icon: <Smartphone className="h-4 w-4" /> },
  ]

  const trackingRows: Array<{ key: "analytics" | "advertising" | "personalisation"; label: string; hint: string }> = [
    { key: "analytics", label: "Analytics", hint: "Helps us understand which pages are used, so we can improve them." },
    { key: "advertising", label: "Advertising", hint: "Lets us measure our ads and show you relevant ones elsewhere." },
    { key: "personalisation", label: "Personalisation", hint: "Recommends products based on what you have viewed." },
  ]

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-maroon-800" />
          <h2 className="text-xl font-bold">Privacy &amp; your data</h2>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Your rights under India&apos;s Digital Personal Data Protection Act, 2023. You can withdraw any
          consent at any time — it is as easy to take back as it was to give, and it will not affect anything
          we did lawfully before you withdrew it.
        </p>
      </header>

      {/* s.11 — right to access */}
      <section className="rounded-lg border border-gray-200 p-5">
        <div className="flex items-start gap-3">
          <Download className="mt-1 h-5 w-5 shrink-0 text-maroon-800" />
          <div className="flex-1">
            <h3 className="font-semibold">Download your data</h3>
            <p className="mt-1 text-sm text-gray-600">
              A complete copy of the personal data we hold about you, the organisations we have shared it with
              and what each one received, your full consent history, and how long we keep each category.
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-maroon-800 px-4 py-2 text-sm font-medium text-white hover:bg-maroon-900 disabled:opacity-60"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Preparing…" : "Download my data"}
            </button>
          </div>
        </div>
      </section>

      {/* s.6(4) — withdraw marketing consent */}
      <section className="rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold">Marketing messages</h3>
        <p className="mt-1 text-sm text-gray-600">
          These are optional. Turning them off does not affect order confirmations, delivery updates or other
          messages we must send to complete a purchase you asked for.
        </p>
        <div className="mt-4 space-y-3">
          {marketingRows.map((row) => (
            <label key={row.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-md bg-gray-50 p-3">
              <span className="flex items-start gap-3">
                <span className="mt-0.5 text-gray-500">{row.icon}</span>
                <span>
                  <span className="block text-sm font-medium">{row.label}</span>
                  <span className="block text-xs text-gray-500">{row.hint}</span>
                </span>
              </span>
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-maroon-800"
                checked={marketing[row.key]}
                disabled={loadingPrefs || savingPrefs}
                onChange={(e) => saveMarketing({ ...marketing, [row.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </section>

      {/* s.6(4) — withdraw tracking consent */}
      <section className="rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2">
          <Cookie className="h-5 w-5 text-maroon-800" />
          <h3 className="font-semibold">Cookies &amp; tracking</h3>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Strictly necessary cookies — your sign-in session, your cart and fraud prevention — cannot be turned
          off, because the site cannot work without them. Everything else is your choice.
        </p>
        <div className="mt-4 space-y-3">
          {trackingRows.map((row) => (
            <label key={row.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-md bg-gray-50 p-3">
              <span>
                <span className="block text-sm font-medium">{row.label}</span>
                <span className="block text-xs text-gray-500">{row.hint}</span>
              </span>
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-maroon-800"
                checked={Boolean(tracking?.[row.key])}
                onChange={(e) => saveTracking({ [row.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </section>

      {/* s.12(1) + s.13 */}
      <section className="rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-maroon-800" />
          <h3 className="font-semibold">Correct your data, or raise a concern</h3>
        </div>
        <ul className="mt-2 space-y-2 text-sm text-gray-600">
          <li>
            Something wrong or out of date?{" "}
            <Link href="/account/profile" className="font-medium text-maroon-800 underline">
              Update your profile
            </Link>
            .
          </li>
          <li>
            Unhappy with how we handle your data?{" "}
            <Link href="/complaints?category=data-privacy" className="font-medium text-maroon-800 underline">
              Raise a data-privacy grievance
            </Link>{" "}
            — our Grievance Officer responds within {dpdpConfig.grievanceSlaDays} days.
          </li>
          <li>
            Still not satisfied, you may complain to the Data Protection Board of India.
          </li>
          <li>
            Full details are in our{" "}
            <Link href="/privacy-policy" className="font-medium text-maroon-800 underline">
              Privacy Notice
            </Link>
            .
          </li>
        </ul>
      </section>

      {/* s.12(3) — right to erasure */}
      <section className="rounded-lg border border-red-200 bg-red-50 p-5">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-700" />
          <h3 className="font-semibold text-red-800">Delete my account</h3>
        </div>
        <p className="mt-1 text-sm text-red-900">
          This permanently removes your profile, cart, wishlist, saved addresses, enquiries and marketing
          profile, and signs you out of every device.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-white p-3 text-sm text-gray-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <strong>Your invoices are kept, but anonymised.</strong> GST law requires us to keep invoice and
            payment records for 72 months, so we cannot delete them. We do erase your name, email, phone
            number and address from inside them, so they no longer identify you. This is the legal-compliance
            exception in section 12(3) of the DPDP Act.
          </p>
        </div>

        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="mt-4 rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-4 space-y-3 rounded-md border border-red-300 bg-white p-4">
            <div>
              <label htmlFor="delete-password" className="block text-sm font-medium text-gray-700">
                Confirm your password
              </label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Leave blank if you sign in with Google"
              />
            </div>
            <div>
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-gray-700">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false)
                  setDeletePassword("")
                  setDeleteConfirm("")
                }}
                disabled={deleting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
