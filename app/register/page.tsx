"use client"

import type React from "react"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useAuth } from "@/contexts/AuthContext"
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, AlertTriangle, Shield, Check, X } from "lucide-react"
import { useRateLimit, formatRemainingTime } from "@/hooks/useRateLimit"
import { useRecaptcha } from "@/hooks/useRecaptcha"
import DOMPurify from "isomorphic-dompurify"

function PasswordStrength({ password }: { password: string }) {
  const strength = useMemo(() => {
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return Math.min(score, 4)
  }, [password])

  if (!password) return null

  const labels = ["Weak", "Fair", "Good", "Strong"]
  const colors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500"]
  const textColors = ["text-red-500", "text-orange-500", "text-amber-500", "text-green-500"]

  return (
    <div className="mt-2">
      <div className="flex gap-1.5 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < strength ? colors[strength - 1] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${textColors[strength - 1]}`}>
        {labels[strength - 1]}
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  })
  const [formTimestamp] = useState(Date.now())
  const [honeypot, setHoneypot] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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
  } = useRateLimit('register_attempts')

  const { enabled: recaptchaEnabled, isReady: recaptchaReady, error: recaptchaError, getToken } = useRecaptcha("signup")

  const { signup, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, router])

  // Arriving from a guest order confirmation, so the email is already known.
  useEffect(() => {
    const email = searchParams.get("email")
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormData((prev) => (prev.email ? prev : { ...prev, email }))
    }
  }, [searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    const sanitizedValue = type === "checkbox"
      ? checked
      : DOMPurify.sanitize(value.trim(), {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: []
        })

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : sanitizedValue,
    }))

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const passwordChecks = useMemo(() => {
    const p = formData.password
    return [
      { label: "At least 8 characters", met: p.length >= 8 },
      { label: "One uppercase letter", met: /[A-Z]/.test(p) },
      { label: "One lowercase letter", met: /[a-z]/.test(p) },
      { label: "One number", met: /\d/.test(p) },
    ]
  }, [formData.password])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters"
    }

    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    } else if (formData.password.length > 128) {
      newErrors.password = "Password must be less than 128 characters"
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = "Password must contain uppercase, lowercase, and a number"
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password"
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the terms"
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

    setIsSubmitting(true)

    try {
      const success = await signup(
        formData.name,
        formData.email,
        formData.password,
        honeypot,
        formTimestamp,
        recaptchaToken || undefined,
        formData.confirmPassword,
        formData.agreeToTerms
      )
      if (success) {
        resetAttempts()
        router.push("/login")
      } else {
        recordAttempt()
        const remainingAttempts = 3 - (attempts + 1)
        if (remainingAttempts > 0) {
          setErrors({
            general: `Registration failed. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
          })
        } else {
          setErrors({
            general: `Too many attempts. Please try again in ${formatRemainingTime(300)}.`
          })
        }
      }
    } catch (error) {
      console.error("Registration error:", error)
      recordAttempt()
      setErrors({ general: "An error occurred. Please try again later." })
    } finally {
      lock.release()
      setIsSubmitting(false)
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
              Free to join
            </span>

            <h1 className="mt-5 font-heading text-[40px] font-bold leading-[1.1] xl:text-[46px]">
              Join
              <br />
              <span className="text-[#9FC4F0]">Sara Electronics</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
              Create your account for faster checkout, order tracking and member-only pricing.
            </p>

            <ul className="mt-10 space-y-5">
              {[
                { title: "Member-only pricing", detail: "Deals not available to guests" },
                { title: "Order history & tracking", detail: "Every purchase in one place" },
                { title: "Wishlist & compare", detail: "Save products and compare specs" },
              ].map(({ title, detail }) => (
                <li key={title} className="flex items-center gap-4">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
                    <Check className="h-5 w-5" strokeWidth={2} />
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
                <h2 className="font-heading text-[24px] font-bold text-[#0F2557]">Create account</h2>
                <p className="mt-1 text-[13px] text-slate-600">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-[#1560BD] hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>

            {/* Alerts */}
            {isLocked && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Registration temporarily locked</p>
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
              {/* Honeypot */}
              <input
                type="text"
                name="website"
                id="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                aria-hidden="true"
              />

              <div>
                <label htmlFor="name" className="mb-1.5 block text-[13px] font-semibold text-[#0F2557]">
                  Full name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className={`h-4 w-4 transition-colors ${focusedField === "name" ? "text-[#1560BD]" : "text-slate-400"}`} />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    className={`block h-11 w-full rounded-lg border pl-10 pr-3 text-[14px] outline-none transition-colors ${
                      errors.name
                        ? "border-red-400 bg-red-50/40"
                        : "border-gray-300 focus:border-[#1560BD] focus:ring-2 focus:ring-[#1560BD]/15"
                    }`}
                    placeholder="John Doe"
                  />
                </div>
                {errors.name && <p className="mt-1.5 text-[12px] text-red-600">{errors.name}</p>}
              </div>

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
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    className={`block h-11 w-full rounded-lg border pl-10 pr-11 text-[14px] outline-none transition-colors ${
                      errors.password
                        ? "border-red-400 bg-red-50/40"
                        : "border-gray-300 focus:border-[#1560BD] focus:ring-2 focus:ring-[#1560BD]/15"
                    }`}
                    placeholder="Create a password"
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

                {/* Password Strength */}
                <PasswordStrength password={formData.password} />

                {/* Password Requirements */}
                {formData.password && (
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {passwordChecks.map((check) => (
                      <div key={check.label} className="flex items-center gap-1.5">
                        {check.met ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-gray-300" />
                        )}
                        <span className={`text-xs ${check.met ? 'text-green-600' : 'text-brand-text-tertiary'}`}>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-[13px] font-semibold text-[#0F2557]">
                  Confirm password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className={`h-4 w-4 transition-colors ${focusedField === "confirm" ? "text-[#1560BD]" : "text-slate-400"}`} />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setFocusedField("confirm")}
                    onBlur={() => setFocusedField(null)}
                    className={`block h-11 w-full rounded-lg border pl-10 pr-11 text-[14px] outline-none transition-colors ${
                      errors.confirmPassword
                        ? "border-red-400 bg-red-50/40"
                        : "border-gray-300 focus:border-[#1560BD] focus:ring-2 focus:ring-[#1560BD]/15"
                    }`}
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-600"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1.5 text-[12px] text-red-600">{errors.confirmPassword}</p>}
              </div>

              <div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleChange}
                    className={`mt-0.5 h-4 w-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary/40 ${errors.agreeToTerms ? "border-red-400" : ""}`}
                  />
                  <span className="text-sm text-brand-text-secondary leading-snug">
                    I agree to the{" "}
                    <Link href="/terms-and-conditions" className="font-medium text-[#1560BD] hover:underline">Terms</Link>
                    {" "}and{" "}
                    <Link href="/privacy-policy" className="font-medium text-[#1560BD] hover:underline">Privacy Policy</Link>
                  </span>
                </label>
                {errors.agreeToTerms && <p className="mt-1.5 text-sm text-red-500">{errors.agreeToTerms}</p>}
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
                    Creating account...
                  </>
                ) : recaptchaEnabled && !recaptchaReady ? (
                  <>
                    <Shield className="h-4 w-4" />
                    Initializing security...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
