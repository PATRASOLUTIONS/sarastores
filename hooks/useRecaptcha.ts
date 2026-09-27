import { useCallback, useEffect, useMemo, useState } from 'react'

// Minimal typings for the Google reCAPTCHA v3 global
declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
const SCRIPT_ID = 'recaptcha-v3-script'

export function useRecaptcha(action: string) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enabled = useMemo(() => Boolean(RECAPTCHA_SITE_KEY), [])

  useEffect(() => {
    if (!enabled) return

    // If already loaded, mark ready
    if (document.getElementById(SCRIPT_ID) && window.grecaptcha) {
      window.grecaptcha.ready(() => setIsReady(true))
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => setIsReady(true))
      }
    }
    script.onerror = () => {
      setError('Failed to load reCAPTCHA')
    }

    document.body.appendChild(script)
  }, [enabled])

  const getToken = useCallback(async () => {
    if (!enabled) return null
    if (!window.grecaptcha || !isReady) {
      setError('reCAPTCHA not ready. Please try again.')
      return null
    }

    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY as string, { action })
      return token
    } catch (e) {
      setError('Failed to execute reCAPTCHA. Please retry.')
      return null
    }
  }, [action, enabled, isReady])

  return { enabled, isReady, error, getToken }
}
