import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/forgot-password",
  title: (brand) => `Reset Your Password | ${brand}`,
  description: "Request a password reset link for your Sara Electronics account.",
  noIndex: true,
})

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
