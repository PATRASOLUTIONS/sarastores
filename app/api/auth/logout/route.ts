import { NextResponse } from "next/server"
import { SESSION_COOKIE } from "@/lib/session"

export async function POST() {
  try {
    const response = NextResponse.json({
      message: "Logged out successfully",
    })

    const expire = {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 0,
      path: "/",
    }

    const domainOpt = process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}

    // Clear the authoritative session cookie and the cosmetic user cookie
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, ...domainOpt, ...expire })
    response.cookies.set("user", "", { httpOnly: false, ...domainOpt, ...expire })

    return response
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ message: "An error occurred during logout" }, { status: 500 })
  }
}
