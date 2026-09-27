"use client"

import { useState, useEffect, Suspense } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from "lucide-react"

function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lock = useSubmitLock()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tokenParam = searchParams?.get("token")
    if (!tokenParam) {
      setError("Invalid reset link. Please request a new password reset.")
    } else {
      setToken(tokenParam)
    }
  }, [searchParams])

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) {
      return "Password must be at least 8 characters long"
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter"
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter"
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!token) {
      setError("Invalid reset link. Please request a new password reset.")
      return
    }

    if (!password || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!lock.acquire()) return
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push("/login")
        }, 3000)
      } else {
        setError(data.error || "Failed to reset password. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again later.")
    } finally {
      lock.release()
      setIsSubmitting(false)
    }
  }

  const getPasswordStrength = (pwd: string) => {
    let strength = 0
    if (pwd.length >= 8) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[a-z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^A-Za-z0-9]/.test(pwd)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(password)

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-brand-primary-subtle via-white to-brand-primary-light py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-brand-primary to-brand-primary-hover rounded-full p-4">
                <KeyRound className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
              Reset Password
            </h1>
            <p className="text-center text-gray-600 mb-8">
              Enter your new password below
            </p>

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Password reset successful!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Redirecting to login page...
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {!success && token && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* New Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter new password"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded ${
                              level <= passwordStrength
                                ? passwordStrength <= 2
                                  ? "bg-red-500"
                                  : passwordStrength <= 3
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                                : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-600">
                        {passwordStrength <= 2 && "Weak password"}
                        {passwordStrength === 3 && "Medium password"}
                        {passwordStrength >= 4 && "Strong password"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Confirm new password"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-700 mb-2">Password must contain:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li className="flex items-center">
                      <span className={password.length >= 8 ? "text-green-600" : ""}>
                        {password.length >= 8 ? "✓" : "○"} At least 8 characters
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className={/[A-Z]/.test(password) ? "text-green-600" : ""}>
                        {/[A-Z]/.test(password) ? "✓" : "○"} One uppercase letter
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className={/[a-z]/.test(password) ? "text-green-600" : ""}>
                        {/[a-z]/.test(password) ? "✓" : "○"} One lowercase letter
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className={/[0-9]/.test(password) ? "text-green-600" : ""}>
                        {/[0-9]/.test(password) ? "✓" : "○"} One number
                      </span>
                    </li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Resetting Password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>
            )}

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
