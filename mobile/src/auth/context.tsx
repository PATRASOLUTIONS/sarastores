import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { onForcedSignOut } from "@/api/client"
import * as authApi from "@/api/auth"
import type { AuthUser } from "@/api/types"
import { clearTokens, getCachedUser, getRefreshToken, setAccessToken } from "@/auth/token-store"
import { registerForPushNotifications, unregisterPushToken } from "@/notifications/push"

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: (idToken: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: (password?: string) => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const applySignedIn = useCallback(async (nextUser: AuthUser) => {
    setUser(nextUser)
    // Registration is per-session: the token must follow the signed-in account
    // or order notifications go to whoever used the handset last.
    void registerForPushNotifications()
  }, [])

  const signOut = useCallback(async () => {
    await unregisterPushToken()
    await authApi.logout()
    await clearTokens()
    setUser(null)
  }, [])

  // Restore a session on cold start. The cached user paints the signed-in shell
  // immediately; the network call then confirms or clears it.
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const cached = await getCachedUser()
      if (!cancelled && cached) setUser(cached)

      const refreshToken = await getRefreshToken()
      if (!refreshToken) {
        if (!cancelled) {
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      try {
        // Force a refresh by treating the in-memory access token as absent.
        setAccessToken(null)
        const confirmed = await authApi.fetchSession()
        if (!cancelled) {
          setUser(confirmed)
          if (confirmed) void registerForPushNotifications()
        }
      } catch {
        // Offline launch: keep the cached user so the app is usable, and let
        // the next authenticated request sort out the token.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => onForcedSignOut(() => setUser(null)), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      signIn: async (email, password) => {
        const next = await authApi.login(email, password)
        await applySignedIn(next)
      },
      signInWithGoogle: async (idToken) => {
        const next = await authApi.loginWithGoogle(idToken)
        await applySignedIn(next)
      },
      signOut,
      deleteAccount: async (password) => {
        await authApi.deleteAccount(password)
        await clearTokens()
        setUser(null)
      },
      refresh: async () => {
        const confirmed = await authApi.fetchSession()
        setUser(confirmed)
      },
    }),
    [user, isLoading, applySignedIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}
