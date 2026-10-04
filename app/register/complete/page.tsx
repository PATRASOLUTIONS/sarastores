"use client"

/**
 * Google sign-up completion — terms and DPDP consent.
 *
 * Reached only from the Google OAuth callback, which refuses to create an
 * account for an unrecognised Google identity until the person accepts the
 * terms and has seen the Section 5 notice. Until this form is submitted no user
 * record exists, so abandoning the page leaves nothing stored.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { PRIVACY_NOTICE_VERSION } from "@/lib/dpdp-config"

export default function CompleteGoogleSignupPage() {
  const router = useRouter()

  const [token, setToken] = useState<string | null>(null)
  const [next, setNext] = useState("/")
  const [ready, setReady] = useState(false)

  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacyNotice, setAcceptPrivacyNotice] = useState(false)
  const [marketingEmail, setMarketingEmail] = useState(false)
  const [marketingWhatsapp, setMarketingWhatsapp] = useState(false)
  const [marketingSms, setMarketingSms] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /**
   * Read from `window.location` rather than `useSearchParams` so this page does
   * not need a Suspense boundary under Next 15's client-router rules.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get("token"))
    const candidate = params.get("next")
    // Only ever follow a same-site path — an absolute URL here would be an
    // open redirect straight off the back of an auth flow.
    if (candidate && candidate.startsWith("/") && !candidate.startsWith("//")) {
      setNext(candidate)
    }
    setReady(true)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!acceptTerms) {
      setError("Please accept the terms and conditions")
      return
    }
    if (!acceptPrivacyNotice) {
      setError("Please confirm you have read the privacy notice")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          acceptTerms: true,
          acceptPrivacyNotice: true,
          marketingEmail,
          marketingWhatsapp,
          marketingSms,
          noticeVersion: PRIVACY_NOTICE_VERSION,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.message || "Could not finish signing you up.")
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setError("Could not reach the server. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) return null

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="h-8 w-8 text-amber-500" />
        <h1 className="mt-3 text-lg font-bold text-[#0F2557]">This link is no longer valid</h1>
        <p className="mt-1.5 text-[13px] text-slate-600">
          Your sign-up session expired before it was finished. Nothing was saved.
        </p>
        <Link
          href="/login"
          className="mt-5 rounded-lg bg-[#1560BD] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#0F2557]"
        >
          Sign in again
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#1560BD]" />
          <h1 className="text-lg font-bold text-[#0F2557]">One last step</h1>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
          Google confirmed your email. Before we create your account, please review the terms and how your data
          will be used.{" "}
          <strong className="font-semibold text-slate-700">Nothing has been saved yet.</strong>
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <p className="text-[12.5px] font-semibold text-[#0F2557]">How we use your details</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
              We collect your <strong>name and email address</strong> and, later at checkout, your{" "}
              <strong>phone number and delivery address</strong>, so we can create your account, process your orders
              and issue GST invoices. We keep invoice records for 72 months because tax law requires it. You can
              access, correct, export or erase your data, withdraw consent at any time, or complain to the Data
              Protection Board of India.{" "}
              <Link href="/privacy-policy" className="font-medium text-[#1560BD] hover:underline">
                Read the full privacy notice
              </Link>
              .
            </p>
          </div>

          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1560BD] focus:ring-[#1560BD]/40"
              />
              <span className="text-[13px] leading-snug text-slate-600">
                I agree to the{" "}
                <Link href="/terms-and-conditions" className="font-medium text-[#1560BD] hover:underline">
                  Terms and Conditions
                </Link>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={acceptPrivacyNotice}
                onChange={(e) => setAcceptPrivacyNotice(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1560BD] focus:ring-[#1560BD]/40"
              />
              <span className="text-[13px] leading-snug text-slate-600">
                I have read the{" "}
                <Link href="/privacy-policy" className="font-medium text-[#1560BD] hover:underline">
                  Privacy Notice
                </Link>{" "}
                and consent to my data being processed to run my account and orders
              </span>
            </label>
          </div>

          {/*
            Optional and genuinely severable — consent that is a condition of
            getting the service is not "free" under Section 6(1).
          */}
          <div className="rounded-lg border border-slate-200 p-3.5">
            <p className="text-[12.5px] font-semibold text-[#0F2557]">
              Keep me posted <span className="font-normal text-slate-500">(optional)</span>
            </p>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              Entirely your choice — your account works exactly the same either way.
            </p>
            <div className="mt-2.5 space-y-2">
              {[
                { label: "Email me offers, price drops and new arrivals", value: marketingEmail, set: setMarketingEmail },
                { label: "Send me offers on WhatsApp", value: marketingWhatsapp, set: setMarketingWhatsapp },
                { label: "Send me offers by SMS", value: marketingSms, set: setMarketingSms },
              ].map((item) => (
                <label key={item.label} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={item.value}
                    onChange={(e) => item.set(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1560BD] focus:ring-[#1560BD]/40"
                  />
                  <span className="text-[13px] leading-snug text-slate-600">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-[12.5px] text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1560BD] text-[14px] font-bold text-white transition-colors hover:bg-[#0F2557] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating your account…
              </>
            ) : (
              "Create my account"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
