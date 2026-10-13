import type React from "react"
import { redirect } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { getSession } from "@/lib/auth"
import AccountClientShell from "./account-client-shell"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/account", title: brand => `My Account | ${brand}`,
  description: "Manage your SARA account and preferences. Personal information is available only after sign-in.",
  noIndex: true,
})

// Reads the session cookie, so it can never be prerendered at build time.
export const dynamic = "force-dynamic"

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Server-side authoritative auth check using the signed httpOnly session
  // cookie. This is the source of truth — it works in both localhost and
  // production because it does not depend on hydration timing, localStorage
  // state, or middleware redirect races.
  const session = await getSession()

  if (!session?.user) {
    redirect("/login?redirect=/account")
  }

  return (
    <AccountClientShell user={session.user}>
      {children}
    </AccountClientShell>
  )
}
