export class RecaptchaConfigurationError extends Error {
  constructor() {
    super("Security validation is temporarily unavailable. Please try again later.")
    this.name = "RecaptchaConfigurationError"
  }
}

export function isRecaptchaEnabled(): boolean {
  const flag = process.env.RECAPTCHA_ENABLED?.trim()
  if (flag && flag !== "true" && flag !== "false") {
    console.error("[reCAPTCHA] RECAPTCHA_ENABLED must be true or false")
    throw new RecaptchaConfigurationError()
  }
  if (flag) return flag === "true"
  return Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SECRET_KEY)
}

export function getRecaptchaConfiguration(): { enabled: boolean; siteKey: string | null } {
  if (!isRecaptchaEnabled()) return { enabled: false, siteKey: null }
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim()
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim()
  if (!siteKey || !secret) {
    console.error("[reCAPTCHA] Enabled CAPTCHA requires both the v3 site key and secret key")
    throw new RecaptchaConfigurationError()
  }
  return { enabled: true, siteKey }
}
