"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface User {
  email: string
  name: string
  role: string
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
}

export function useAdminAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated
    const storedAuth = localStorage.getItem("adminAuth")
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth)
        setAuthState(parsedAuth)
      } catch (error) {
        console.error("Error parsing auth data:", error)
        // Clear invalid auth data
        localStorage.removeItem("adminAuth")
      }
    }
    setLoading(false)
  }, [])

  const login = (user: User) => {
    const newAuthState = {
      isAuthenticated: true,
      user,
    }
    localStorage.setItem("adminAuth", JSON.stringify(newAuthState))
    setAuthState(newAuthState)
  }

  const logout = () => {
    localStorage.removeItem("adminAuth")
    setAuthState({
      isAuthenticated: false,
      user: null,
    })
    router.push("/admin/login")
  }

  return {
    ...authState,
    loading,
    login,
    logout,
  }
}
