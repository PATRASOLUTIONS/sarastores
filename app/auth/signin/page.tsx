"use client"

import type React from "react"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-8" />
          <div className="max-w-md space-y-4">
            <div className="h-12 bg-gray-100 rounded animate-pulse" />
            <div className="h-12 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  )
}

function SignInForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo =
    searchParams.get("redirect") ||
    searchParams.get("callbackUrl") ||
    searchParams.get("next") ||
    "/dashboard"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    })

    if (result?.error) {
      // Handle error (e.g., show error message)
      console.error(result.error)
    } else {
      // Redirect back to the page the user tried to open, or the dashboard.
      router.push(redirectTo)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Sign In</h1>
      <form onSubmit={handleSubmit} className="max-w-md">
        <div className="mb-4">
          <label htmlFor="email" className="block mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Sign In
        </button>
      </form>
    </div>
  )
}
