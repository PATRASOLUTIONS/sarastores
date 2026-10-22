"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef } from "react"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"
import { destinationAfterLogin, loginHref, safeReturnPath } from "@/lib/return-path"

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
  dateOfBirth?: string
  emailVerified?: boolean
}

/**
 * DPDP Act 2023 consent fields collected at registration.
 *
 * Marketing flags are deliberately separate from `acceptTerms`: Section 6(1)
 * requires consent to be specific and unconditional, so agreeing to the Terms
 * must not drag marketing permission along with it.
 */
export interface SignupDpdpFields {
  acceptPrivacyNotice?: boolean
  marketingEmail?: boolean
  marketingWhatsapp?: boolean
  marketingSms?: boolean
  noticeVersion?: string
}

export type SignupResult = { ok: true } | { ok: false; message: string; code?: string }

interface AuthContextType {
  user: User | null
  isLoading: boolean
    login: (email: string, password: string, recaptchaToken?: string) => Promise<true | "rejected" | "unavailable">
    signup: (name: string, email: string, password: string, honeypot?: string, formTimestamp?: number, recaptchaToken?: string, confirmPassword?: string, acceptTerms?: boolean, dpdp?: SignupDpdpFields) => Promise<SignupResult>
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
  const authEpoch = useRef(0)
  const loginInProgress = useRef(false)
  const loginGraceUntil = useRef(0)
  const logoutRequest = useRef<AbortController | null>(null)
  const router = useRouter()
  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  const ACTIVITY_TIMEOUT = 12 * 60 * 60 * 1000 // 12 hours of inactivity
  const COOKIE_GRACE_PERIOD = 250 // allow Set-Cookie propagation before redirecting

  const clearStoredAuth = (preserveRedirect = false) => {
    localStorage.removeItem("user")
    if (!preserveRedirect) localStorage.removeItem("redirectAfterLogin")
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

  const clearClientAuthState = (preserveRedirect = false) => {
    authEpoch.current++
    setUser(null)
    clearStoredAuth(preserveRedirect)
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
    const epoch = authEpoch.current
    try {
      if (!baseUser.id) {
        return
      }

      const res = await fetch(`/api/users/${baseUser.id}`)
      if (!res.ok) {
        return
      }

      const fullUser = await res.json().catch(() => null)
      if (fullUser && epoch === authEpoch.current && !getSessionInvalidReason()) {
        persistClientUser(fullUser)
      }
    } catch (error) {
      console.warn("Failed to refresh user profile", error)
    }
  }

  const fetchSessionUser = async (): Promise<User | null> => {
    const epoch = authEpoch.current
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      })
      if (!response.ok) {
        return null
      }

      const data = await response.json().catch(() => null)
      if (epoch !== authEpoch.current) return null
      if (!data?.user) {
        clearClientAuthState(true)
        return null
      }

      const invalidReason = getSessionInvalidReason()
      if (invalidReason) {
        invalidateSession(invalidReason, true)
        return null
      }
      persistClientUser(data.user)
      return data.user
    } catch (error) {
      console.warn("Failed to hydrate auth session", error)
      return null
    }
  }

  const cancelPendingLogout = () => {
    logoutRequest.current?.abort()
    logoutRequest.current = null
  }

  const requestLogout = () => {
    cancelPendingLogout()
    const controller = new AbortController()
    logoutRequest.current = controller
    fetch("/api/auth/logout", { method: "POST", signal: controller.signal }).catch((err) => {
      if (err instanceof DOMException && err.name === "AbortError") return
      console.error("Error clearing expired session:", err)
    })
  }

  const invalidateSession = (reason?: "expired" | "inactive" | "missing-cookie", notify = false) => {
    clearClientAuthState()
    requestLogout()

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
    const checkAuth = async () => {
      try {
        // Only an explicit login needs to wait for Set-Cookie propagation.
        // A stored UI hint must never resurrect a missing server session.
        const sessionUser = await fetchSessionUser()
        if (sessionUser) await refreshUserProfile(sessionUser)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    const syncAuthState = () => {
      fetchSessionUser().catch((error) => {
        console.warn("Failed to sync auth session", error)
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAuthState()
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== "user") return
      syncAuthState()
    }

    const handleFocusSync = () => {
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
      if (loginInProgress.current || Date.now() < loginGraceUntil.current) return
      // A single 401 is not proof the session is gone. Wishlist, profile and
      // cart calls race the new cookie, and a busy database used to answer
      // 401 for a token that was still valid. Confirm with the session
      // endpoint before clearing the cookie — that call is what was signing
      // everyone out while they were trying to log in.
      void (async () => {
        if (loginInProgress.current || Date.now() < loginGraceUntil.current) return
        try {
          const res = await originalFetch("/api/auth/session", {
            cache: "no-store",
            credentials: "same-origin",
          })
          if (!res.ok) return
          const data = await res.json().catch(() => null)
          if (data?.user) return
        } catch {
          return
        }
        if (loginInProgress.current || Date.now() < loginGraceUntil.current) return
        authEpoch.current++
        setUser((currentUser) => {
          if (!currentUser) return currentUser
          clearStoredAuth()
          requestLogout()
          toast.error("Your session has expired. Please log in again.")
          return null
        })
      })()
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
      const currentPath = safeReturnPath(`${window.location.pathname}${window.location.search}`)
      if (currentPath) localStorage.setItem("redirectAfterLogin", currentPath)
      router.push(loginHref(window.location.pathname, window.location.search))
      return false
    }
    return true
  }

  const login = async (email: string, password: string, recaptchaToken?: string): Promise<true | "rejected" | "unavailable"> => {
    setIsLoading(true)
    loginInProgress.current = true
    // A slow logout from an older tab timeout must not land after this login
    // and wipe the cookie that was just issued.
    cancelPendingLogout()
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, recaptchaToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.message || data.error || "Login failed")
        return "rejected"
      }

      // The password was accepted and the cookie was set. Ignore stray 401s
      // from the admin dashboard's first requests while that cookie settles.
      loginGraceUntil.current = Date.now() + 20000
      authEpoch.current++
      const epoch = authEpoch.current

      // Do not publish `user` or call /api/users yet. Those requests run before
      // the new cookie is visible, come back 401, and the global handler then
      // logs the shopper out with "session expired".
      const sessionUser = await (async (): Promise<User | null> => {
        const isProd = process.env.NODE_ENV === "production"
        const maxWait = isProd ? 8000 : 5000
        const start = Date.now()
        while (Date.now() - start < maxWait) {
          if (epoch !== authEpoch.current) return null
          try {
            const res = await fetch("/api/auth/session", {
              cache: "no-store",
              credentials: "same-origin",
            })
            if (res.ok) {
              const body = await res.json().catch(() => null)
              if (body?.user?.id) return body.user as User
            }
          } catch {
            // Cookie not visible yet, or the session store blipped. Retry.
          }
          await new Promise((r) => setTimeout(r, 200))
        }
        return null
      })()

      if (epoch !== authEpoch.current) return "unavailable"
      // A slow session read must not discard a login that already set the
      // cookie. The login response user is enough to enter the dashboard.
      const signedIn = sessionUser ?? (data.user?.id ? data.user as User : null)
      if (!signedIn) return "unavailable"

      localStorage.setItem("user", JSON.stringify({
        id: signedIn.id,
        role: signedIn.role,
      }))
      localStorage.setItem("loginTime", Date.now().toString())
      localStorage.setItem("lastActivityTime", Date.now().toString())
      setUser(signedIn)

      const redirectPath = localStorage.getItem("redirectAfterLogin")
      localStorage.removeItem("redirectAfterLogin")
      const destination = destinationAfterLogin(signedIn, redirectPath)
      const isStaff = signedIn.role === "admin" || signedIn.role === "superadmin" || signedIn.dashboardAccess === true
      toast.success(isStaff ? "Admin login successful!" : signedIn.role === "vendor" ? "Vendor login successful!" : "Login successful!")
      window.location.assign(destination)

      return true
    } catch (error) {
      console.error("Login error:", error)
      toast.error("Login failed. Please try again.")
      return "rejected"
    } finally {
      loginInProgress.current = false
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
    acceptTerms?: boolean,
    dpdp?: SignupDpdpFields
  ): Promise<SignupResult> => {
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
          // DPDP: per-purpose consent, kept distinct from acceptTerms.
          acceptPrivacyNotice: dpdp?.acceptPrivacyNotice ?? true,
          marketingEmail: dpdp?.marketingEmail ?? false,
          marketingWhatsapp: dpdp?.marketingWhatsapp ?? false,
          marketingSms: dpdp?.marketingSms ?? false,
          noticeVersion: dpdp?.noticeVersion,
          website: honeypot || '', // Honeypot field
          formTimestamp: formTimestamp || Date.now(), // Form timestamp
          recaptchaToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          ok: false,
          message: typeof data?.message === "string" && data.message ? data.message : "Signup failed. Please try again.",
          code: typeof data?.code === "string" ? data.code : undefined,
        }
      }

      // DO NOT auto-login after signup
      // Do not set user in state, do not store in localStorage
      // User must manually login
      toast.success(data.message || "Thanks. We have sent a link to confirm your email address.")

      return { ok: true }
    } catch (error) {
      console.error("Signup error:", error)
      return { ok: false, message: "Signup failed. Please try again." }
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
    clearClientAuthState()
    const controller = new AbortController()
    cancelPendingLogout()
    logoutRequest.current = controller

    fetch("/api/auth/logout", { method: "POST", signal: controller.signal })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error("Error during logout:", err)
      })
      .finally(() => {
        if (logoutRequest.current !== controller) return
        toast.success("Logged out successfully")
        router.push("/")
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
