"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useAuth } from "@/contexts/AuthContext"
import { Eye, EyeOff, Mail, Lock, ArrowLeft, AlertTriangle, Shield, ShoppingCart, Zap, Headphones, BadgeCheck } from "lucide-react"
import { useRateLimit, formatRemainingTime } from "@/hooks/useRateLimit"
import { useRecaptcha } from "@/hooks/useRecaptcha"
import DOMPurify from "isomorphic-dompurify"

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lock = useSubmitLock()
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const {
    attempts,
    isLocked,
    remainingTime,
    recordAttempt,
    resetAttempts,
    canAttempt
  } = useRateLimit('login_attempts')

  const { enabled: recaptchaEnabled, isReady: recaptchaReady, error: recaptchaError, getToken } = useRecaptcha("login")

  const { login, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect") || "/"

  useEffect(() => {
    if (isAuthenticated && !isSubmitting) {
      router.push(redirectTo)
    }
  }, [isAuthenticated, isSubmitting, router, redirectTo])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const sanitizedValue = DOMPurify.sanitize(value.trim(), {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    })
    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }))
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }
    if (!formData.password) {
      newErrors.password = "Password is required"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLocked || !canAttempt) {
      setErrors({
        general: `Too many failed attempts. Please try again in ${formatRemainingTime(remainingTime)}.`
      })
      return
    }

    if (!validateForm()) return
    if (!lock.acquire()) return

    let recaptchaToken: string | null = null
    if (recaptchaEnabled) {
      if (!recaptchaReady) {
        setErrors({ general: "Security check is still loading. Please try again in a moment." })
        lock.release()
        return
      }
      recaptchaToken = await getToken()
      if (!recaptchaToken) {
        setErrors({ general: recaptchaError || "Security validation failed. Please try again." })
        lock.release()
        return
      }
    }

    if (redirectTo && redirectTo !== "/" && redirectTo.startsWith("/")) {
      localStorage.setItem("redirectAfterLogin", redirectTo)
    }

    setIsSubmitting(true)

    try {
      const success = await login(formData.email, formData.password, recaptchaToken || undefined)
      if (success) {
        resetAttempts()
        return
      }

      recordAttempt()
      const remainingAttempts = 3 - (attempts + 1)

      if (remainingAttempts > 0) {
        setErrors({
          general: `Invalid credentials. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before temporary lockout.`
        })
      } else {
        setErrors({
          general: `Account temporarily locked due to multiple failed attempts. Please try again in ${formatRemainingTime(300)}.`
        })
      }
      setIsSubmitting(false)
      lock.release()
    } catch (error) {
      console.error("Login error:", error)
      recordAttempt()
      setErrors({ general: "An error occurred. Please try again later." })
      setIsSubmitting(false)
      lock.release()
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F9FC]">
      <Header />
      <main className="flex flex-grow" id="main-content">
        {/* Left: Brand Panel */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0F2557] via-[#12336E] to-[#1560BD] lg:flex lg:w-[46%]">
          <div className="absolute inset-0 opacity-[0.07]">
            <div className="absolute -left-10 top-16 h-72 w-72 rounded-full bg-white blur-3xl" />
            <div className="absolute -right-10 bottom-16 h-96 w-96 rounded-full bg-white blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col justify-center px-14 py-16 text-white xl:px-16">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-inset ring-white/20">
              <BadgeCheck className="h-3.5 w-3.5" />
              SARA Member
            </span>

            <h1 className="mt-5 font-heading text-[40px] font-bold leading-[1.1] xl:text-[46px]">
              Welcome back to
              <br />
              <span className="text-[#9FC4F0]">Sara Electronics</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
              Sign in to track orders, save your favourites and unlock member-only pricing.
            </p>

            <ul className="mt-10 space-y-5">
              {[
                { icon: ShoppingCart, title: "Fast checkout", detail: "Your address and details, saved" },
                { icon: Zap, title: "Exclusive deals", detail: "Member prices and early access" },
                { icon: Headphones, title: "Priority support", detail: "Dedicated help for your account" },
              ].map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex items-center gap-4">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">{title}</span>
                    <span className="block text-[12.5px] text-white/65">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-12 text-[12px] text-white/50">From Karnataka, for a brighter tomorrow.</p>
          </div>
        </div>

        {/* Right: Form */}
        <div className="flex w-full items-center justify-center px-5 py-10 sm:px-8 lg:w-[54%]">
          <div className="w-full max-w-[420px]">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-[#1560BD]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to store
            </Link>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-6">
                <h2 className="font-heading text-[24px] font-bold text-[#0F2557]">Sign in</h2>
                <p className="mt-1 text-[13px] text-slate-600">
                  New to SARA?{" "}
                  <Link href="/register" className="font-semibold text-[#1560BD] hover:underline">
                    Create an account
                  </Link>
                </p>
              </div>

            {/* Alerts */}
            {isLocked && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Account temporarily locked</p>
                  <p className="text-sm text-red-600 mt-0.5">
                    Too many failed attempts. Try again in {formatRemainingTime(remainingTime)}.
                  </p>
                </div>
              </div>
            )}

            {!isLocked && attempts > 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  {3 - attempts} attempt{3 - attempts !== 1 ? 's' : ''} remaining before temporary lockout.
                </p>
              </div>
            )}

            {errors.general && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            {/* Social Login First */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-[#0F2557]">
                  Email address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className={`h-4 w-4 transition-colors ${focusedField === "email" ? "text-[#1560BD]" : "text-slate-400"}`} />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    className={`block h-11 w-full rounded-lg border pl-10 pr-3 text-[14px] outline-none transition-colors ${
                      errors.email
                        ? "border-red-400 bg-red-50/40"
                        : "border-gray-300 focus:border-[#1560BD] focus:ring-2 focus:ring-[#1560BD]/15"
                    }`}
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && <p className="mt-1.5 text-[12px] text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-[#0F2557]">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className={`h-4 w-4 transition-colors ${focusedField === "password" ? "text-[#1560BD]" : "text-slate-400"}`} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    className={`block h-11 w-full rounded-lg border pl-10 pr-11 text-[14px] outline-none transition-colors ${
                      errors.password
                        ? "border-red-400 bg-red-50/40"
                        : "border-gray-300 focus:border-[#1560BD] focus:ring-2 focus:ring-[#1560BD]/15"
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-[12px] text-red-600">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-[#1560BD] focus:ring-[#1560BD]/30"
                  />
                  <span className="text-[13px] text-slate-600">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-[13px] font-semibold text-[#1560BD] hover:underline">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isLocked || !canAttempt || (recaptchaEnabled && !recaptchaReady)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1560BD] text-[14px] font-bold text-white transition-colors hover:bg-[#0F2557] focus:outline-none focus:ring-2 focus:ring-[#1560BD]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLocked ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Locked ({formatRemainingTime(remainingTime)})
                  </>
                ) : isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : recaptchaEnabled && !recaptchaReady ? (
                  <>
                    <Shield className="h-4 w-4" />
                    Initializing security...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
            </div>

            <p className="mt-5 text-center text-[11.5px] leading-relaxed text-slate-500">
              By signing in, you agree to our{" "}
              <Link href="/terms-and-conditions" className="text-[#1560BD] hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" className="text-[#1560BD] hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
