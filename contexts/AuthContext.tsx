"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"

export interface User {
  id: string
  name: string
  email: string
  role: "admin" | "superadmin" | "user" | "vendor"
  /** Staff claims issued by lib/session.ts alongside the role. */
  dashboardAccess?: boolean
  allowedPages?: string[]
  avatar?: string
  phone?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  createdAt?: string
  emailVerified?: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
    login: (email: string, password: string, recaptchaToken?: string) => Promise<boolean>
    signup: (name: string, email: string, password: string, honeypot?: string, formTimestamp?: number, recaptchaToken?: string, confirmPassword?: string, acceptTerms?: boolean) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
  isVendor: boolean
  /** Mirrors checkAdminAuthorization() in lib/auth.ts: admin, superadmin or granted dashboardAccess. */
  canAccessAdmin: boolean
  updateProfile: (userData: Partial<User>) => Promise<boolean>
  checkAuthAndRedirect: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  const ACTIVITY_TIMEOUT = 12 * 60 * 60 * 1000 // 12 hours of inactivity
  const COOKIE_GRACE_PERIOD = 250 // allow Set-Cookie propagation before redirecting

  const clearStoredAuth = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("redirectAfterLogin")
    localStorage.removeItem("lastActivityTime")
    localStorage.removeItem("loginTime")
  }

  const readStoredTimestamp = (key: "lastActivityTime" | "loginTime") => {
    const value = localStorage.getItem(key)

    if (!value) {
      return null
    }

    const timestamp = Number.parseInt(value, 10)
    return Number.isFinite(timestamp) ? timestamp : null
  }

  const clearClientAuthState = () => {
    setUser(null)
    clearStoredAuth()
  }

  const persistClientUser = (nextUser: User | null) => {
    // Skip if the user data is actually the same to avoid unnecessary
    // localStorage writes and state updates that cascade into cart re-loads.
    const current = localStorage.getItem("user")
    const next = nextUser ? JSON.stringify(nextUser) : null
    if (current === next) return

    setUser(nextUser)
    if (nextUser) {
      localStorage.setItem("user", JSON.stringify({
        id: nextUser.id,
        role: nextUser.role,
      }))
    } else {
      localStorage.removeItem("user")
    }
    if (!localStorage.getItem("loginTime")) {
      localStorage.setItem("loginTime", Date.now().toString())
    }
    if (!localStorage.getItem("lastActivityTime")) {
      localStorage.setItem("lastActivityTime", Date.now().toString())
    }
  }

  const refreshUserProfile = async (baseUser: User) => {
    try {
      if (!baseUser.id) {
        return
      }

      const res = await fetch(`/api/users/${baseUser.id}`)
      if (!res.ok) {
        return
      }

      const fullUser = await res.json().catch(() => null)
      if (fullUser && !getSessionInvalidReason()) {
        persistClientUser(fullUser)
      }
    } catch (error) {
      console.warn("Failed to refresh user profile", error)
    }
  }

  const fetchSessionUser = async (): Promise<User | null> => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      })
      if (!response.ok) {
        return null
      }

      const data = await response.json().catch(() => null)
      if (!data?.user) {
        return null
      }

      persistClientUser(data.user)
      return data.user
    } catch (error) {
      console.warn("Failed to hydrate auth session", error)
      return null
    }
  }

  const invalidateSession = (reason?: "expired" | "inactive" | "missing-cookie", notify = false) => {
    clearClientAuthState()

    fetch("/api/auth/logout", { method: "POST" }).catch((err) => {
      console.error("Error clearing expired session:", err)
    })

    if (!notify) {
      return
    }

    if (reason === "expired") {
      toast.error("Your session has expired after 24 hours. Please log in again.")
      return
    }

    if (reason === "inactive") {
      toast.error("You have been logged out due to inactivity.")
    }
  }

  const getSessionInvalidReason = (): "expired" | "inactive" | "missing-cookie" | null => {
    const storedUser = localStorage.getItem("user")

    if (!storedUser) {
      return null
    }

    // The httpOnly `session` cookie is the real source of truth on the
    // server. The non-httpOnly `user` cookie is only a UI hint and can be
    // blocked by browsers or stripped by proxies, so we must not log the
    // client out just because that cosmetic cookie is absent.
    const loginTime = readStoredTimestamp("loginTime")

    const currentTime = Date.now()
    const lastActivityTime = readStoredTimestamp("lastActivityTime")

    if (loginTime && currentTime - loginTime >= SESSION_TIMEOUT) {
      return "expired"
    }

    if (lastActivityTime && currentTime - lastActivityTime >= ACTIVITY_TIMEOUT) {
      return "inactive"
    }

    if (!loginTime) {
      localStorage.setItem("loginTime", currentTime.toString())
    }

    if (!lastActivityTime) {
      localStorage.setItem("lastActivityTime", currentTime.toString())
    }

    return null
  }

  const getStoredUserIfValid = (notifyOnInvalid = false): User | null => {
    const invalidReason = getSessionInvalidReason()

    if (invalidReason) {
      invalidateSession(invalidReason, notifyOnInvalid)
      return null
    }

    const storedUser = localStorage.getItem("user")

    if (!storedUser) {
      setUser(null)
      return null
    }

    try {
      return JSON.parse(storedUser)
    } catch (error) {
      console.error("Failed to parse user from storage", error)
      invalidateSession()
      return null
    }
  }

  // Function to handle user activity
  const handleUserActivity = () => {
    // Store the current timestamp when user is active
    if (user) {
      localStorage.setItem('lastActivityTime', Date.now().toString())
    }
  }

  // Function to check session timeout
  const checkSessionTimeout = () => {
    const invalidReason = getSessionInvalidReason()

    if (invalidReason) {
      invalidateSession(invalidReason, true)
    }
  }

  // Event listeners for user activity
  useEffect(() => {
    if (user) {
      // Set initial activity time when user logs in
      localStorage.setItem('lastActivityTime', Date.now().toString())
      
      // Set login time if not already set
      if (!localStorage.getItem('loginTime')) {
        localStorage.setItem('loginTime', Date.now().toString())
      }
      
      // Add event listeners for user activity
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
      events.forEach(event => {
        window.addEventListener(event, handleUserActivity)
      })

      // Check session every minute
      const sessionCheckInterval = setInterval(checkSessionTimeout, 60000)

      // Also check immediately on mount
      checkSessionTimeout()

      return () => {
        // Clean up event listeners
        events.forEach(event => {
          window.removeEventListener(event, handleUserActivity)
        })
        clearInterval(sessionCheckInterval)
      }
    }
  }, [user])

  useEffect(() => {
    // Check if user is logged in from localStorage
    const checkAuth = async () => {
      try {
        // Server-side session is the source of truth (httpOnly, signed cookie).
        // We poll for it briefly so we don't race against Set-Cookie propagation
        // on production deploys (CDN/proxy delays).
        let sessionUser: User | null = null
        const isProd = process.env.NODE_ENV === "production"
        const maxWait = isProd ? 8000 : 5000
        const start = Date.now()
        while (!sessionUser && Date.now() - start < maxWait) {
          sessionUser = await fetchSessionUser()
          if (!sessionUser) {
            await new Promise((r) => setTimeout(r, 200))
          }
        }

        // Only fall back to localStorage if the server confirms no session.
        // This prevents logging a user out just because the cosmetic
        // localStorage entry has not yet been written.
        const parsedUser = sessionUser ? null : getStoredUserIfValid(true)
        const activeUser = sessionUser || parsedUser

        if (!activeUser) {
          return
        }

        // Set a minimal user immediately then try to refresh full user from API
        setUser(activeUser)
        await refreshUserProfile(activeUser)

        // Check session timeout on initial load
        checkSessionTimeout()
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    const syncAuthState = () => {
      const nextUser = getStoredUserIfValid()

      if (!nextUser) {
        fetchSessionUser().catch((error) => {
          console.warn("Failed to sync auth session", error)
        })
        return
      }

      setUser((currentUser) => {
        const currentSerialized = currentUser ? JSON.stringify(currentUser) : null
        const nextSerialized = JSON.stringify(nextUser)

        return currentSerialized === nextSerialized ? currentUser : nextUser
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAuthState()
      }
    }

    // Only update user state if the data is meaningfully different.
    // Shallow-compare the serialized forms before writing to avoid
    // triggering downstream effects (cart reload, etc.) on every
    // focus/visibility-change that doesn't actually change the user.
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== "user") return
      try {
        const nextUser = e.newValue ? JSON.parse(e.newValue) : null
        setUser((current) => {
          const nextSerialized = e.newValue
          const currentSerialized = current ? JSON.stringify(current) : null
          if (currentSerialized === nextSerialized) return current
          return nextUser
        })
      } catch {
        // ignore parse errors
      }
    }

    const handleFocusSync = () => {
      // Avoid re-fetching if a session poll is already in-flight
      if (document.hidden) return
      syncAuthState()
    }

    window.addEventListener("focus", handleFocusSync)
    window.addEventListener("storage", handleStorageChange)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleFocusSync)
      window.removeEventListener("storage", handleStorageChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  // Global 401 detector. Wraps `window.fetch` once on mount and listens for
  // a throttled `auth:expired` event. This is the single source of truth
  // for "the server told us our session is no longer valid" — any hook
  // (wishlist, cart, addresses, etc.) that gets a 401 from `/api/*` will
  // end up clearing the client auth state and surfacing a toast, instead
  // of leaving the user with a stale "logged in" UI and a flood of
  // per-hook error toasts.
  useEffect(() => {
    if (typeof window === "undefined") return

    const originalFetch = window.fetch.bind(window)
    const DISPATCH_THROTTLE_MS = 5000
    let lastDispatchAt = 0

    const isSkippedEndpoint = (url: string) => {
      return (
        url.includes("/api/auth/login") ||
        url.includes("/api/auth/signup") ||
        url.includes("/api/auth/forgot-password") ||
        url.includes("/api/auth/reset-password") ||
        url.includes("/api/auth/verify-email") ||
        url.includes("/api/auth/google") ||
        url.includes("/api/auth/session") ||
        url.includes("/api/auth/logout") ||
        url.includes("/api/auth/config")
      )
    }

    const patchedFetch = async function patchedFetch(
      ...args: Parameters<typeof fetch>
    ): Promise<Response> {
      const response = await originalFetch(...args)
      try {
        if (response.status !== 401) return response

        const input = args[0]
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input && typeof input === "object" && "url" in input
                ? (input as Request).url
                : ""

        if (!url) return response
        if (!url.includes("/api/")) return response
        if (isSkippedEndpoint(url)) return response

        const now = Date.now()
        if (now - lastDispatchAt < DISPATCH_THROTTLE_MS) return response
        lastDispatchAt = now

        window.dispatchEvent(
          new CustomEvent("auth:expired", { detail: { source: url } }),
        )
      } catch {
        // never let the wrapper throw — that would break the caller's promise
      }
      return response
    }

    window.fetch = patchedFetch as typeof window.fetch

    const onAuthExpired = () => {
      // Use functional setState to read the *current* user without making
      // this effect re-subscribe on every user change. We also clear local
      // state and call the server-side logout to drop the (invalid) cookie
      // for any subsequent same-tab requests. The throttling in
      // `patchedFetch` already prevents loops even if /api/auth/logout
      // itself were to 401.
      setUser((currentUser) => {
        if (!currentUser) return currentUser
        clearStoredAuth()
        fetch("/api/auth/logout", { method: "POST" }).catch(() => {
          // best-effort — the cookie is already invalid server-side
        })
        toast.error("Your session has expired. Please log in again.")
        return null
      })
    }

    window.addEventListener("auth:expired", onAuthExpired)

    return () => {
      window.fetch = originalFetch
      window.removeEventListener("auth:expired", onAuthExpired)
    }
  }, [])

  const checkAuthAndRedirect = (): boolean => {
    if (!user) {
      // Store current page to redirect back after login.
      // Only allow relative paths to prevent open-redirect attacks.
      const currentPath = window.location.pathname
      if (currentPath && currentPath.startsWith('/') && !currentPath.startsWith('//') && !currentPath.match(/^https?:/)) {
        localStorage.setItem("redirectAfterLogin", currentPath)
      }
      router.push("/login")
      return false
    }
    return true
  }

  const login = async (email: string, password: string, recaptchaToken?: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, recaptchaToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.message || "Login failed")
        return false
      }

      // Store minimal user data in localStorage (id + role only).
      // Full user profile is fetched from the server on page load.
      localStorage.setItem("user", JSON.stringify({
        id: data.user.id,
        role: data.user.role,
      }))
      localStorage.setItem('loginTime', Date.now().toString())
      localStorage.setItem('lastActivityTime', Date.now().toString())
      setUser(data.user)

      try {
        if (data.user?.id) {
          const r = await fetch(`/api/users/${data.user.id}`)
          if (r.ok) {
            const full = await r.json().catch(()=>null)
            if (full) {
              setUser(full)
              localStorage.setItem('user', JSON.stringify({
                id: full.id,
                role: full.role,
              }))
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch full user after login', e)
      }

      // Check for redirect path (validate it's a safe relative URL)
      const redirectPath = localStorage.getItem("redirectAfterLogin")
      localStorage.removeItem("redirectAfterLogin")
      const safeRedirectPath =
        redirectPath &&
        redirectPath.startsWith('/') &&
        !redirectPath.startsWith('//') &&
        !redirectPath.match(/^https?:/)
          ? redirectPath
          : null

      // Helper to navigate. In production use a full page load so the
      // authoritative, httpOnly session cookie from the login response is
      // guaranteed to be included in subsequent server-side requests. In
      // development we can keep SPA navigation for speed.
      const navigateTo = (url: string) => {
        if (process.env.NODE_ENV === "production") {
          window.location.assign(url)
        } else {
          router.push(url)
        }
      }

      // Wait for the server-side session to be available. Some hosting/CDN
      // configurations may delay Set-Cookie propagation; poll for up to
      // 8 seconds in production (5s in dev) before proceeding to improve
      // reliability. The server route is the authoritative source: if the
      // httpOnly session cookie was set, /api/auth/session will return the
      // user; if not, the cookie has not propagated yet and we keep polling.
      const waitForServerSession = async (timeout?: number, interval = 200) => {
        const isProd = process.env.NODE_ENV === "production"
        const maxWait = typeof timeout === "number" ? timeout : isProd ? 8000 : 5000
        const start = Date.now()
        while (Date.now() - start < maxWait) {
          try {
            const res = await fetch("/api/auth/session", {
              cache: "no-store",
              credentials: "same-origin",
            })
            if (res.ok) {
              const j = await res.json().catch(() => null)
              if (j && j.user) return true
            }
          } catch (e) {
            // ignore and retry
          }
          await new Promise((r) => setTimeout(r, interval))
        }
        return false
      }

      const sessionReady = await waitForServerSession()

      // Redirect based on user role or stored path
      if (data.user.role === "admin") {
        toast.success("Admin login successful!")
        if (!sessionReady) toast.error("Server session not yet visible; continuing anyway.")
        navigateTo("/admin/dashboard")
      } else if (data.user.role === "vendor") {
        toast.success("Vendor login successful!")
        if (!sessionReady) toast.error("Server session not yet visible; continuing anyway.")
        navigateTo("/vendor/dashboard")
      } else if (safeRedirectPath && safeRedirectPath !== "/login" && safeRedirectPath !== "/register") {
        toast.success("Login successful!")
        if (!sessionReady) toast.error("Server session not yet visible; continuing anyway.")
        navigateTo(safeRedirectPath)
      } else {
        toast.success("Login successful!")
        if (!sessionReady) toast.error("Server session not yet visible; continuing anyway.")
        navigateTo("/dashboard")
      }

      return true
    } catch (error) {
      console.error("Login error:", error)
      toast.error("Login failed. Please try again.")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (
    name: string, 
    email: string, 
    password: string, 
    honeypot?: string, 
    formTimestamp?: number,
    recaptchaToken?: string,
    confirmPassword?: string,
    acceptTerms?: boolean
  ): Promise<boolean> => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          name, 
          email, 
          password,
          confirmPassword: confirmPassword ?? password,
          acceptTerms: acceptTerms ?? true,
          website: honeypot || '', // Honeypot field
          formTimestamp: formTimestamp || Date.now(), // Form timestamp
          recaptchaToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.message || "Signup failed")
        return false
      }

      // DO NOT auto-login after signup
      // Do not set user in state, do not store in localStorage
      // User must manually login

      toast.success("Account created successfully! Welcome email sent to your inbox.")

      return true
    } catch (error) {
      console.error("Signup error:", error)
      toast.error("Signup failed. Please try again.")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (userData: Partial<User>): Promise<boolean> => {
    if (!user) return false

    setIsLoading(true)
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to update profile")
      }

      const updatedUser = await response.json()
      persistClientUser(updatedUser)
      toast.success("Profile updated successfully!")
      return true
    } catch (error) {
      console.error("Profile update error:", error)
      toast.error("Profile update failed. Please try again.")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    clearStoredAuth()

    // Clear cookies by making a request to a logout endpoint
    fetch("/api/auth/logout", { method: "POST" })
      .catch((err) => console.error("Error during logout:", err))
      .finally(() => {
        toast.success("Logged out successfully")
        router.push("/")
        // Force a full page reload to ensure all state is cleared
        window.location.href = "/"
      })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin" || user?.role === "superadmin",
        isVendor: user?.role === "vendor" || user?.role === "admin" || user?.role === "superadmin",
        canAccessAdmin:
          user?.role === "admin" || user?.role === "superadmin" || user?.dashboardAccess === true,
        updateProfile,
        checkAuthAndRedirect,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
