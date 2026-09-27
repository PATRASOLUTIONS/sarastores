import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/verify-email",
  title: (brand) => `Verify Your Email | ${brand}`,
  description: "Confirm your email address to activate your account.",
  noIndex: true,
})

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
