"use client"

/**
 * Tracking consent banner — DPDP Act 2023, Sections 5 and 6.
 *
 * Analytics and advertising are not necessary to run a storefront, so they
 * require consent. Two design points matter legally:
 *
 *  - Reject is exactly as prominent as Accept. Section 6(1) requires consent to
 *    be free; a dark-patterned "Accept" next to a buried "Manage" is not.
 *  - Nothing non-essential loads until a choice is made. The tag gates treat
 *    "no decision yet" as a refusal.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Cookie, X } from "lucide-react"
import {
  readConsent,
  writeConsent,
  CONSENT_REOPEN_EVENT,
  type TrackingCategory,
} from "@/lib/consent-client"

type Choice = Record<TrackingCategory, boolean>

const CATEGORY_COPY: Array<{
  key: TrackingCategory
  title: string
  description: string
}> = [
  {
    key: "analytics",
    title: "Usage measurement",
    description:
      "Counts page views and checkout steps so we can see which parts of the site are failing people. Never used to target ads.",
  },
  {
    key: "advertising",
    title: "Advertising",
    description:
      "Lets us show you our products on other websites and measure whether an ad led to a purchase.",
  },
  {
    key: "personalisation",
    title: "Recommendations",
    description:
      "Uses what you have viewed and bought to suggest products that may suit you.",
  },
]

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [choice, setChoice] = useState<Choice>({
    analytics: false,
    advertising: false,
    personalisation: false,
  })

  useEffect(() => {
    // Rendered only after mount so the server HTML stays identical for every
    // visitor and remains cacheable.
    if (readConsent() === null) setVisible(true)
  }, [])

  // The footer's "Cookie preferences" link reopens the banner with the current
  // choice loaded, so withdrawing is exactly as easy as consenting (s.6(4)).
  useEffect(() => {
    const reopen = () => {
      const current = readConsent()
      if (current) {
        setChoice({
          analytics: current.analytics,
          advertising: current.advertising,
          personalisation: current.personalisation,
        })
      }
      setShowDetail(true)
      setVisible(true)
    }
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen)
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen)
  }, [])

  const decide = (value: Choice) => {
    writeConsent(value)
    setVisible(false)
    setShowDetail(false)
  }

  const acceptAll = () =>
    decide({ analytics: true, advertising: true, personalisation: true })
  const rejectAll = () =>
    decide({ analytics: false, advertising: false, personalisation: false })

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-banner-title"
      className="fixed inset-x-0 bottom-0 z-[9998] border-t border-slate-200 bg-white shadow-[0_-4px_24px_rgba(15,37,87,0.12)]"
    >
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        {!showDetail ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Cookie className="mt-0.5 hidden h-5 w-5 shrink-0 text-[#FF6A2C] sm:block" />
              <div>
                <p id="consent-banner-title" className="text-[14px] font-semibold text-[#0F2557]">
                  Your choice about tracking
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                  We need a few cookies to keep you signed in and your cart working — those stay on.
                  Beyond that, we would like to measure usage and show you relevant ads, but only if
                  you agree. You can change your mind at any time.{" "}
                  <Link href="/privacy-policy" className="font-medium text-[#1560BD] hover:underline">
                    Privacy notice
                  </Link>
                </p>
              </div>
            </div>
            {/* Equal weight for accept and reject — a nudged choice is not free consent. */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDetail(true)}
                className="h-10 rounded-lg px-3 text-[13px] font-semibold text-[#1560BD] transition-colors hover:bg-slate-100"
              >
                Choose
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="h-10 rounded-lg border border-[#0F2557] px-4 text-[13px] font-bold text-[#0F2557] transition-colors hover:bg-slate-50"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="h-10 rounded-lg bg-[#0F2557] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1560BD]"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4">
              <p className="text-[14px] font-semibold text-[#0F2557]">Choose what you allow</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowDetail(false)}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#0F2557]">Strictly necessary</p>
                  <span className="text-[11.5px] font-semibold text-slate-500">Always on</span>
                </div>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  Signing in, your cart, and fraud prevention. The site cannot work without these, so
                  they are not consent-based.
                </p>
              </div>

              {CATEGORY_COPY.map(({ key, title, description }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={choice[key]}
                    onChange={(e) => setChoice((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F2557] focus:ring-[#0F2557]/40"
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-[#0F2557]">{title}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-600">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={rejectAll}
                className="h-10 rounded-lg border border-[#0F2557] px-4 text-[13px] font-bold text-[#0F2557] transition-colors hover:bg-slate-50"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => decide(choice)}
                className="h-10 rounded-lg bg-[#0F2557] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1560BD]"
              >
                Save my choices
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
