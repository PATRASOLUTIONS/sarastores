"use client"

import { useState } from "react"
import Image from "next/image"
import { 
  ArrowRight, 
  Gift, 
  User, 
  CheckCircle, 
  Shield, 
  Award 
} from "lucide-react"

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold shadow-sm ${
      className || ""
    }`}
  >
    {children}
  </div>
)

const Button = ({
  children,
  className = "",
  variant = "solid",
  size = "md",
  disabled,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  variant?: "solid" | "outline"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  onClick?: () => void
}) => {
  const base = "rounded-full inline-flex items-center justify-center font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2";
  const sizes: Record<string, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-base",
  }
  const variants: Record<string, string> = {
    solid: "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700",
    outline: "bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50",
  }
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`
  return (
    <button onClick={onClick} disabled={disabled} className={cls} aria-disabled={disabled}>
      {children}
    </button>
  )
}

export default function OTTSection() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGetStarted = () => {
    window.open("https://www.systechdigital.co.in/ott", "_blank")
  }

  const handleCustomerDashboard = () => {
    window.open("https://ott.systechdigital.co.in/redeem-now", "_blank")
  }

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/6 to-purple-600/6"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-6 lg:space-y-8">
            <div className="space-y-3">
              <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <Gift className="w-4 h-4 mr-2" />
                Limited Time Offer
              </Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight">
                Unlock Premium
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {" "}
                  OTT Entertainment
                </span>
              </h2>
              <p className="text-lg text-gray-600 max-w-xl">
                Instant access to 28 premium OTT platforms with the OTTplay Power Play Pack. Stream unlimited
                movies, shows and live content on all your devices — one code, many services.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
              <div className="w-full sm:w-auto">
                <Button onClick={handleGetStarted} size="lg" className="shadow-xl">
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      Claim Your OTT Code
                      <ArrowRight className="w-5 h-5 ml-3" />
                    </>
                  )}
                </Button>
              </div>

              <div>
                <Button onClick={handleCustomerDashboard} variant="outline" size="lg">
                  <User className="w-5 h-5 mr-2" />
                  Redeem Now
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Instant Activation</p>
                  <p className="text-xs text-gray-500">Start streaming within minutes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-600 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Secure & Verified</p>
                  <p className="text-xs text-gray-500">Safe redemption process</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-green-600 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Genuine Codes</p>
                  <p className="text-xs text-gray-500">Authorized distribution</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="relative z-10 w-full max-w-md lg:max-w-lg">
              <Image
                src="/B2B_1050x600.png"
                alt="OTTplay Banner"
                width={900}
                height={540}
                className="rounded-2xl shadow-2xl object-cover w-full h-auto transform hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
            <div className="absolute -top-8 -right-8 w-56 h-56 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-20 blur-3xl"></div>
            <div className="absolute -bottom-6 -left-6 w-48 h-48 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-16 blur-3xl"></div>
          </div>
        </div>
      </div>
    </section>
  )
}