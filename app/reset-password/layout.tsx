import type React from "react"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/reset-password",
  title: (brand) => `Set a New Password | ${brand}`,
  description: "Choose a new password for your Sara Electronics account.",
  noIndex: true,
})

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
