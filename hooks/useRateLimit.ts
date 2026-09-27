import { useState, useEffect, useCallback } from 'react'

interface RateLimitState {
  attempts: number
  isLocked: boolean
  lockoutEnd: number | null
  remainingTime: number
}

interface UseRateLimitReturn {
  attempts: number
  isLocked: boolean
  remainingTime: number
  recordAttempt: () => void
  resetAttempts: () => void
  canAttempt: boolean
}

const MAX_ATTEMPTS = 3
const LOCKOUT_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

/**
 * Hook to manage rate limiting for authentication pages
 * Prevents brute force attacks by limiting attempts and enforcing lockout periods
 * 
 * @param storageKey - Unique key for storing rate limit data in sessionStorage
 * @returns Rate limit state and control functions
 */
export function useRateLimit(storageKey: string): UseRateLimitReturn {
  const [state, setState] = useState<RateLimitState>({
    attempts: 0,
    isLocked: false,
    lockoutEnd: null,
    remainingTime: 0,
  })

  // Load state from sessionStorage on mount
  useEffect(() => {
    const loadState = () => {
      try {
        const stored = sessionStorage.getItem(storageKey)
        if (stored) {
          const parsed: RateLimitState = JSON.parse(stored)
          const now = Date.now()

          // Check if lockout period has expired
          if (parsed.lockoutEnd && parsed.lockoutEnd > now) {
            const remainingTime = Math.ceil((parsed.lockoutEnd - now) / 1000)
            setState({
              ...parsed,
              isLocked: true,
              remainingTime,
            })
          } else if (parsed.lockoutEnd && parsed.lockoutEnd <= now) {
            // Lockout expired, reset state
            const resetState = {
              attempts: 0,
              isLocked: false,
              lockoutEnd: null,
              remainingTime: 0,
            }
            setState(resetState)
            sessionStorage.setItem(storageKey, JSON.stringify(resetState))
          } else {
            setState(parsed)
          }
        }
      } catch (error) {
        console.error('Failed to load rate limit state:', error)
      }
    }

    loadState()
  }, [storageKey])

  // Update remaining time countdown
  useEffect(() => {
    if (!state.isLocked || !state.lockoutEnd) return

    const interval = setInterval(() => {
      const now = Date.now()
      
      if (state.lockoutEnd && state.lockoutEnd <= now) {
        // Lockout period has ended
        const resetState = {
          attempts: 0,
          isLocked: false,
          lockoutEnd: null,
          remainingTime: 0,
        }
        setState(resetState)
        sessionStorage.setItem(storageKey, JSON.stringify(resetState))
      } else {
        // Update remaining time
        const remainingTime = state.lockoutEnd ? Math.ceil((state.lockoutEnd - now) / 1000) : 0
        setState(prev => ({ ...prev, remainingTime }))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [state.isLocked, state.lockoutEnd, storageKey])

  // Record a failed attempt
  const recordAttempt = useCallback(() => {
    setState(prev => {
      const newAttempts = prev.attempts + 1
      const now = Date.now()
      
      let newState: RateLimitState
      
      if (newAttempts >= MAX_ATTEMPTS) {
        // Lock the user out
        const lockoutEnd = now + LOCKOUT_DURATION
        newState = {
          attempts: newAttempts,
          isLocked: true,
          lockoutEnd,
          remainingTime: Math.ceil(LOCKOUT_DURATION / 1000),
        }
      } else {
        newState = {
          ...prev,
          attempts: newAttempts,
          isLocked: false,
          lockoutEnd: null,
          remainingTime: 0,
        }
      }

      // Save to sessionStorage
      sessionStorage.setItem(storageKey, JSON.stringify(newState))
      return newState
    })
  }, [storageKey])

  // Reset attempts (called on successful login/signup)
  const resetAttempts = useCallback(() => {
    const resetState: RateLimitState = {
      attempts: 0,
      isLocked: false,
      lockoutEnd: null,
      remainingTime: 0,
    }
    setState(resetState)
    sessionStorage.removeItem(storageKey)
  }, [storageKey])

  const canAttempt = !state.isLocked && state.attempts < MAX_ATTEMPTS

  return {
    attempts: state.attempts,
    isLocked: state.isLocked,
    remainingTime: state.remainingTime,
    recordAttempt,
    resetAttempts,
    canAttempt,
  }
}

/**
 * Format remaining time in MM:SS format
 */
export function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
