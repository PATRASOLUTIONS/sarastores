"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { CheckCircle, XCircle, Mail, ArrowLeft, Loader2 } from "lucide-react"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const status = searchParams?.get("status")
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendError, setResendError] = useState("")

  const statusConfig: Record<string, { icon: any; color: string; title: string; message: string }> = {
    success: {
      icon: CheckCircle,
      color: "text-green-600",
      title: "Email Verified!",
      message: "Your email has been verified successfully. You can now log in to your account.",
    },
    already: {
      icon: CheckCircle,
      color: "text-green-600",
      title: "Already Verified",
      message: "Your email is already verified. You can log in to your account.",
    },
    invalid: {
      icon: XCircle,
      color: "text-red-600",
      title: "Invalid Link",
      message: "This verification link is invalid or has been used.",
    },
    expired: {
      icon: XCircle,
      color: "text-red-600",
      title: "Link Expired",
      message: "This verification link has expired. Please request a new one.",
    },
    error: {
      icon: XCircle,
      color: "text-red-600",
      title: "Verification Failed",
      message: "Something went wrong. Please try again.",
    },
  }

  const config = statusConfig[status || ""] || {
    icon: Mail,
    color: "text-blue-600",
    title: "Check Your Email",
    message: "We've sent a verification link to your email address. Please click the link to verify your account.",
  }

  const Icon = config.icon

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <main className="flex-grow flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-6">
              <Icon className={`h-16 w-16 mx-auto ${config.color}`} />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">{config.title}</h2>
            <p className="text-gray-600 mb-8">{config.message}</p>

            {(status === "invalid" || status === "expired" || status === "error" || !status) && (
              <div className="space-y-4">
                {!resent && !status && (
                  <button
                    onClick={async () => {
                      setResending(true)
                      setResendError("")
                      try {
                        const storedUser = localStorage.getItem("user")
                        if (storedUser) {
                          const user = JSON.parse(storedUser)
                          const res = await fetch("/api/auth/verify-email", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: user.id }),
                          })
                          if (res.ok) {
                            setResent(true)
                          } else {
                            setResendError("Failed to resend. Please try again.")
                          }
                        } else {
                          setResendError("Please log in first to resend verification email.")
                        }
                      } catch {
                        setResendError("Failed to resend. Please try again.")
                      } finally {
                        setResending(false)
                      }
                    }}
                    disabled={resending}
                    className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {resending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      "Resend Verification Email"
                    )}
                  </button>
                )}

                {resent && (
                  <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                    Verification email sent! Check your inbox.
                  </p>
                )}

                {resendError && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{resendError}</p>
                )}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <Link
                href="/login"
                className="block w-full py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Go to Login
              </Link>
              <Link
                href="/"
                className="flex items-center justify-center text-blue-600 hover:text-blue-800 text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
