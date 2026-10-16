import { useCallback, useEffect, useState } from 'react'

// Minimal typings for the Google reCAPTCHA v3 global
declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

const SCRIPT_ID = 'recaptcha-v3-script'
let scriptPromise: Promise<void> | null = null

function loadRecaptcha(siteKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Security validation timed out. Reload the page to retry.')), 15000)
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (!window.grecaptcha) {
        clearTimeout(timer)
        reject(new Error('Security validation could not load. Reload the page to retry.'))
        return
      }
      window.grecaptcha.ready(() => {
        clearTimeout(timer)
        resolve()
      })
    }
    script.onerror = () => {
      clearTimeout(timer)
      reject(new Error('Security validation could not load. Check your connection and reload the page.'))
    }
    document.body.appendChild(script)
  })
  return scriptPromise
}

export function useRecaptcha(action: string) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [siteKey, setSiteKey] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function initialize() {
      try {
        const response = await fetch('/api/auth/config', { cache: 'no-store', signal: AbortSignal.timeout(15000) })
        const data = await response.json()
        if (!response.ok) throw new Error('Security validation is unavailable. Please try again later.')
        const config = data.recaptcha
        if (!config || typeof config.enabled !== 'boolean' ||
          (config.enabled && (typeof config.siteKey !== 'string' || !config.siteKey.trim()))) {
          throw new Error('Security validation configuration is invalid. Please contact support.')
        }
        if (!active) return
        setEnabled(config.enabled)
        setSiteKey(config.siteKey)
        if (config.enabled) await loadRecaptcha(config.siteKey)
        if (active) setIsReady(true)
      } catch (cause) {
        console.error('[reCAPTCHA] Initialization failed')
        if (active) setError(cause instanceof Error ? cause.message : 'Security validation could not load. Reload the page.')
      }
    }
    void initialize()
    return () => { active = false }
  }, [])

  const getToken = useCallback(async () => {
    if (!enabled) return null
    if (!window.grecaptcha || !isReady || !siteKey) {
      throw new Error(error || 'Security validation is not ready. Please try again.')
    }

    try {
      const token = await window.grecaptcha.execute(siteKey, { action })
      if (!token) throw new Error('Empty reCAPTCHA token')
      setError(null)
      return token
    } catch {
      const message = 'Security validation failed. Reload the page or contact support if it persists.'
      console.error('[reCAPTCHA] Token execution failed; check the v3 key and allowed hostname')
      setError(message)
      throw new Error(message)
    }
  }, [action, enabled, isReady, siteKey, error])

  return { enabled, isReady, error, getToken }
}
