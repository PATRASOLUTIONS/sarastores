"use client"

import { useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lock = useSubmitLock()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (!email) {
      setError("Please enter your email address")
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    if (!lock.acquire()) return
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.toLowerCase() }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setEmail("")
      } else {
        setError(data.error || "Failed to send reset link. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again later.")
    } finally {
      lock.release()
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-brand-primary-subtle via-white to-brand-primary-light py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          {/* Back to Login Link */}
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Link>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-brand-primary to-brand-primary-hover rounded-full p-4">
                <Mail className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
              Forgot Password?
            </h1>
            <p className="text-center text-gray-600 mb-8">
              No worries! Enter your email and we'll send you reset instructions.
            </p>

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Email sent successfully!</p>
                  <p className="text-sm text-green-700 mt-1">
                    If an account exists with this email, you will receive password reset instructions shortly.
                    Please check your inbox and spam folder.
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                  />
                </div>
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
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            {/* Additional Info */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{" "}
                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-800 text-center">
              🔒 For security reasons, the reset link will expire in 1 hour.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
