"use client"

import { useState, useEffect } from "react"
import { Mail, User, Lock } from "lucide-react"
import { toast } from "react-hot-toast"

interface InStorePurchaseProps {
  onVerified: (data: { employeeId: string; email: string }) => void
}

export default function InStorePurchase({ onVerified }: InStorePurchaseProps) {
  const [email, setEmail] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [otp, setOtp] = useState("")
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isValidEmployee, setIsValidEmployee] = useState(false)
  const [validationMessage, setValidationMessage] = useState("")

  // Validate employee when ID or email changes
  useEffect(() => {
    const validateEmployee = async () => {
      if (!employeeId || !email) {
        setIsValidEmployee(false)
        setValidationMessage("")
        return
      }

      setIsValidating(true)
      try {
        const res = await fetch("/api/employees/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: employeeId.trim(), email: email.trim() })
        })

        const data = await res.json()
        if (process.env.NODE_ENV === "development") console.log("Validation response:", data)

        setIsValidEmployee(data.valid)
        setValidationMessage(data.message)

        if (!data.valid) {
          toast.error(data.message)
        }
      } catch (err) {
        console.error("Validation error:", err)
        setIsValidEmployee(false)
        setValidationMessage("Error validating employee")
        toast.error("Failed to validate employee")
      } finally {
        setIsValidating(false)
      }
    }

    // Debounce validation
    const timeoutId = setTimeout(() => {
      if (employeeId && email) {
        validateEmployee()
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [employeeId, email])

  const handleSendOtp = async () => {
    if (!isValidEmployee) {
      toast.error("Please enter valid employee credentials")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/store-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, employeeId, action: "verify" })
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message)
      }

      toast.success("OTP sent to your email")
      setShowOtpInput(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp) {
      toast.error("Please enter OTP")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/store-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, employeeId, otp, action: "validate" })
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message)
      }

      toast.success("Verified successfully")
      onVerified({ employeeId, email })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded-lg">
      <div className="space-y-4">
        {/* Email input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Mail className="inline h-4 w-4 mr-1" />
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={showOtpInput}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-maroon-500 ${email && (isValidEmployee ? "border-green-500" : "border-red-500")
              }`}
            placeholder="Enter email"
          />
        </div>

        {/* Employee ID input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <User className="inline h-4 w-4 mr-1" />
            Employee ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={showOtpInput}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-maroon-500 ${employeeId && (isValidEmployee ? "border-green-500" : "border-red-500")
                }`}
              placeholder="Enter employee ID"
            />
            {isValidating && (
              <div className="absolute right-2 top-2">
                <div className="animate-spin h-5 w-5 border-2 border-maroon-500 rounded-full border-t-transparent"></div>
              </div>
            )}
          </div>
          {validationMessage && (
            <p className={`mt-1 text-sm ${isValidEmployee ? "text-green-600" : "text-red-500"}`}>
              {validationMessage}
            </p>
          )}
        </div>

        {/* OTP section */}
        {!showOtpInput ? (
          <button
            onClick={handleSendOtp}
            disabled={isLoading || !isValidEmployee}
            className={`w-full py-2 rounded-md ${isValidEmployee
                ? "bg-maroon-800 text-black hover:bg-maroon-900"
                : "bg-gray-300 text-gray-500"
              } disabled:opacity-50`}
          >
            {isLoading ? "Sending..." : "Send OTP"}
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Lock className="inline h-4 w-4 mr-1" />
                Enter OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-maroon-500"
                placeholder="Enter OTP sent to your email"
                maxLength={6}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleVerifyOtp}
                disabled={isLoading || !otp}
                className="w-full bg-maroon-800 text-black py-2 rounded-md hover:bg-maroon-900 disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify OTP"}
              </button>
              <button
                onClick={handleSendOtp}
                disabled={isLoading}
                className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                Resend OTP
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}