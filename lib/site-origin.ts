/** Parse public website configuration without exposing malformed values in errors. */
export function parseSiteOrigin(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const raw = value.trim()
  if (!raw || /[\s\\\u0000-\u001f\u007f]/.test(raw)) return undefined
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(raw)
  try {
    const url = new URL(hasScheme ? raw : raw.startsWith("//") ? `https:${raw}` : `${local ? "http" : "https"}://${raw}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined
    // A bare value must look like a domain or a loopback address, not a placeholder.
    if (!hasScheme && !url.hostname.includes('.') && !local && !url.hostname.startsWith('[')) return undefined
    return url.origin
  } catch { return undefined }
}

/** Prefer the storefront domain; deployment hostnames are the last fallback. */
export function getConfiguredSiteOrigin(): string | undefined {
  for (const value of [
    process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL,
  ]) {
    const origin = parseSiteOrigin(value)
    if (origin) return canonicalSiteOrigin(origin)
  }
  return undefined
}

/** Match Sara's deployed redirect destination without changing preview/local origins. */
export function canonicalSiteOrigin(origin: string): string {
  const url = new URL(origin)
  if (url.hostname === "sarastores.com" || url.hostname === "www.sarastores.com") return "https://www.sarastores.com"
  return url.origin
}
