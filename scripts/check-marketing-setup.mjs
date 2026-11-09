import { pathToFileURL } from "node:url"

/** Presence/syntax only. Never contacts providers or prints configuration values. */
export function marketingReadiness(env) {
  const rows = []
  const present = name => typeof env[name] === "string" && !!env[name].trim()
  const check = (area, names) => {
    const missing = names.filter(name => !present(name))
    rows.push({ area, status: missing.length ? "missing_configuration" : "configured_unverified", missing })
  }
  const urlNames = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL"]
  const urls = urlNames.map(name => { try { const url = new URL(env[name]); return url.protocol === "https:" ? url.origin : null } catch { return null } })
  rows.push({ area: "Canonical URLs", status: urls.every(Boolean) && new Set(urls).size === 1 ? "configured_unverified" : "missing_or_inconsistent", missing: urlNames.filter((_, index) => !urls[index]) })
  const gtm = /^GTM-[A-Z0-9]+$/.test(env.NEXT_PUBLIC_GTM_ID || ""), ga = /^G-[A-Z0-9]+$/.test(env.NEXT_PUBLIC_GA_ID || "")
  const selected = env.NEXT_PUBLIC_GOOGLE_TAG_MODE?.trim() || (ga ? "direct" : "gtm")
  const valid = selected === "direct" ? ga : selected === "gtm" && gtm
  rows.push({ area: "GA4 / GTM", mode: valid ? selected : "none", status: valid ? "configured_unverified" : "missing_or_invalid",
    missing: valid ? [] : selected === "direct" ? ["NEXT_PUBLIC_GA_ID"] : selected === "gtm" ? ["NEXT_PUBLIC_GTM_ID"] : ["NEXT_PUBLIC_GOOGLE_TAG_MODE (direct or gtm)"] })
  check("Google Merchant API", ["GOOGLE_MERCHANT_ACCOUNT_ID", "GOOGLE_MERCHANT_DATA_SOURCE_ID", "GOOGLE_MERCHANT_CLIENT_ID", "GOOGLE_MERCHANT_CLIENT_SECRET", "GOOGLE_MERCHANT_REFRESH_TOKEN"])
  check("Meta Pixel (optional)", ["NEXT_PUBLIC_META_PIXEL_ID"])
  check("Clarity (optional)", ["NEXT_PUBLIC_CLARITY_ID"])
  rows.push({ area: "Search Console / Merchant claims / Business Profile / Ads / consent", status: "account_and_live_validation_required", missing: [] })
  return { scope: "Local configuration presence and syntax only; account ownership, consent behavior, delivery and attribution are unverified.", checks: rows }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(marketingReadiness(process.env), null, 2))
