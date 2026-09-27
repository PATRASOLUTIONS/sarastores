#!/usr/bin/env node
/**
 * Store-readiness audit for the Expo app.
 *
 * Checks the things Apple App Review and Google Play pre-launch actually reject for,
 * against the real files in mobile/. Exits non-zero if any BLOCKER fails.
 *
 * Usage: node scripts/audit-store-readiness.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const MOBILE = join(ROOT, "mobile")

const results = []
const add = (level, store, id, ok, title, detail = "") =>
  results.push({ level, store, id, ok, title, detail })

const blocker = (...a) => add("BLOCKER", ...a)
const warn = (...a) => add("WARN", ...a)

const read = (p) => readFileSync(join(MOBILE, p), "utf8")
const exists = (p) => existsSync(join(MOBILE, p))
const readJson = (p) => JSON.parse(read(p))

// ---------------------------------------------------------------- config
let app, eas, pkg
try {
  app = readJson("app.json").expo
  eas = readJson("eas.json")
  pkg = readJson("package.json")
} catch (e) {
  console.error("Cannot read app config:", e.message)
  process.exit(1)
}

const PLACEHOLDER = /REPLACE_WITH|CHANGEME|TODO|xxxx/i

// --- identity -----------------------------------------------------------
blocker("both", "identity.bundleId", Boolean(app.ios?.bundleIdentifier) && !PLACEHOLDER.test(app.ios.bundleIdentifier),
  "iOS bundleIdentifier is set", app.ios?.bundleIdentifier ?? "missing")
blocker("both", "identity.package", Boolean(app.android?.package) && !PLACEHOLDER.test(app.android.package),
  "Android package is set", app.android?.package ?? "missing")
blocker("both", "identity.version", /^\d+\.\d+\.\d+$/.test(app.version ?? ""),
  "version is semver", app.version ?? "missing")
blocker("both", "eas.projectId", !PLACEHOLDER.test(app.extra?.eas?.projectId ?? "REPLACE"),
  "EAS projectId is real (needed to build AND for push)", app.extra?.eas?.projectId ?? "missing")
blocker("ios", "submit.appleId", !PLACEHOLDER.test(eas.submit?.production?.ios?.appleId ?? "REPLACE"),
  "EAS submit Apple ID configured", eas.submit?.production?.ios?.appleId ?? "missing")
blocker("ios", "submit.ascAppId", !PLACEHOLDER.test(eas.submit?.production?.ios?.ascAppId ?? "REPLACE"),
  "App Store Connect app ID configured", eas.submit?.production?.ios?.ascAppId ?? "missing")
blocker("ios", "submit.teamId", !PLACEHOLDER.test(eas.submit?.production?.ios?.appleTeamId ?? "REPLACE"),
  "Apple team ID configured", eas.submit?.production?.ios?.appleTeamId ?? "missing")
blocker("android", "submit.serviceAccount", existsSync(join(MOBILE, eas.submit?.production?.android?.serviceAccountKeyPath ?? "nope")),
  "Play service-account key present", eas.submit?.production?.android?.serviceAccountKeyPath ?? "missing")

// --- assets -------------------------------------------------------------
function pngInfo(rel) {
  const p = join(MOBILE, rel.replace(/^\.\//, ""))
  if (!existsSync(p)) return null
  const b = readFileSync(p)
  if (b.slice(1, 4).toString() !== "PNG") return null
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25], bytes: b.length }
}

const icon = pngInfo(app.icon ?? "./assets/icon.png")
blocker("both", "asset.icon.exists", Boolean(icon), "App icon exists and is a PNG", app.icon ?? "")
blocker("both", "asset.icon.size", icon?.width === 1024 && icon?.height === 1024,
  "App icon is 1024x1024", icon ? `${icon.width}x${icon.height}` : "missing")

// ITMS-90717: App Store rejects icons containing an alpha channel. ios.icon wins when set.
const iosIcon = pngInfo(app.ios?.icon ?? app.icon ?? "./assets/icon.png")
blocker("ios", "asset.icon.alpha", iosIcon ? iosIcon.colorType !== 6 && iosIcon.colorType !== 4 : false,
  "iOS icon has NO alpha channel (ITMS-90717)",
  iosIcon ? `${app.ios?.icon ?? app.icon} colorType=${iosIcon.colorType}` : "missing")
blocker("ios", "asset.icon.iosSize", iosIcon?.width === 1024 && iosIcon?.height === 1024,
  "iOS icon is 1024x1024", iosIcon ? `${iosIcon.width}x${iosIcon.height}` : "missing")

const adaptive = pngInfo(app.android?.adaptiveIcon?.foregroundImage ?? "")
blocker("android", "asset.adaptiveIcon", Boolean(adaptive) && adaptive.width >= 432,
  "Android adaptive icon present and >=432px", adaptive ? `${adaptive.width}x${adaptive.height}` : "missing")

const splash = pngInfo(app.splash?.image ?? "")
warn("both", "asset.splash", Boolean(splash), "Splash image present",
  splash ? `${splash.width}x${splash.height}` : "missing")

// Placeholder art is a submission stopper even though it builds fine.
const iconIsPlaceholder = icon ? icon.bytes < 60_000 : true
warn("both", "asset.icon.real", !iconIsPlaceholder,
  "App icon looks like real artwork (not the generated placeholder)",
  icon ? `${(icon.bytes / 1024).toFixed(0)} KB` : "missing")

// --- iOS privacy --------------------------------------------------------
const hasAppPrivacyManifest =
  exists("PrivacyInfo.xcprivacy") ||
  exists("assets/PrivacyInfo.xcprivacy") ||
  (app.ios?.privacyManifests !== undefined)
blocker("ios", "ios.privacyManifest", hasAppPrivacyManifest,
  "App-level privacy manifest declared (ios.privacyManifests in app.json)",
  hasAppPrivacyManifest ? "present" : "absent")

const info = app.ios?.infoPlist ?? {}
const permsNeedingStrings = [
  ["NSLocationWhenInUseUsageDescription", "location"],
  ["NSCameraUsageDescription", "camera"],
  ["NSPhotoLibraryUsageDescription", "photo library"],
]
for (const [key, label] of permsNeedingStrings) {
  blocker("ios", `ios.usage.${label}`, typeof info[key] === "string" && info[key].length > 15,
    `${key} present and descriptive`, info[key] ? "ok" : "missing")
}
blocker("ios", "ios.encryption", info.ITSAppUsesNonExemptEncryption === false,
  "ITSAppUsesNonExemptEncryption declared (skips export compliance prompt)",
  String(info.ITSAppUsesNonExemptEncryption))

// --- Android policy -----------------------------------------------------
const perms = app.android?.permissions ?? []
const blocked = app.android?.blockedPermissions ?? []
warn("android", "android.permissions.minimal", perms.length <= 6,
  "Requested permission list is minimal", perms.join(", ") || "none")
blocker("android", "android.permissions.noStorage",
  blocked.some((p) => p.includes("READ_EXTERNAL_STORAGE")) &&
    blocked.some((p) => p.includes("WRITE_EXTERNAL_STORAGE")),
  "Unscoped storage permissions blocked", blocked.length ? "blocked" : "NOT blocked")
blocker("android", "android.permissions.noOverlay",
  blocked.some((p) => p.includes("SYSTEM_ALERT_WINDOW")),
  "SYSTEM_ALERT_WINDOW blocked", blocked.length ? "blocked" : "NOT blocked")
// Play requires new apps/updates to target a recent API level.
const targetSdk = app.android?.targetSdkVersion ?? app.plugins?.find?.((p) => Array.isArray(p) && p[0] === "expo-build-properties")?.[1]?.android?.targetSdkVersion
warn("android", "android.targetSdk", targetSdk === undefined || targetSdk >= 35,
  "targetSdkVersion is API 35+ (or left to Expo's default)", String(targetSdk ?? "expo default"))

// --- deep links ---------------------------------------------------------
blocker("ios", "links.associatedDomains", (app.ios?.associatedDomains ?? []).length > 0,
  "iOS associatedDomains configured", (app.ios?.associatedDomains ?? []).join(", ") || "none")
blocker("android", "links.intentFilter",
  (app.android?.intentFilters ?? []).some((f) => f.autoVerify),
  "Android App Links autoVerify configured", "")

// --- store policy: what the app actually exposes ------------------------
const appDir = join(MOBILE, "app")
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}
const screenFiles = existsSync(appDir) ? walk(appDir) : []
const allSource = screenFiles.map((f) => readFileSync(f, "utf8")).join("\n")
const routeNames = screenFiles
  .map((f) => f.slice(appDir.length + 1).replace(/\\/g, "/").replace(/\.tsx?$/, ""))
  .filter((r) => !r.startsWith("_"))

// Apple 3.1.1: digital content consumed in-app must use IAP, not a payment gateway.
const sellsSoftware = routeNames.some((r) => /software|licen[cs]e/i.test(r))
blocker("ios", "policy.iap", !sellsSoftware,
  "App does NOT sell digital licences through Razorpay (Apple 3.1.1)",
  sellsSoftware ? "software route present" : "no software route")

// Apple 3.2.2(vi) / Play contests: promotions need official rules + sponsor + eligibility.
const hasPromotion = routeNames.some((r) => /spin|lucky-?draw|contest|sweepstake/i.test(r))
blocker("both", "policy.promotions", !hasPromotion,
  "No prize promotion shipped without official rules (Apple 3.2.2(vi))",
  hasPromotion ? "promotion route present" : "none shipped")

// Apple 5.1.1(v): account deletion must be initiable in-app.
const hasDeletion = /deleteAccount/.test(allSource)
blocker("both", "policy.accountDeletion", hasDeletion,
  "In-app account deletion exists (Apple 5.1.1(v))", hasDeletion ? "found" : "MISSING")

// Apple 5.1.1(i): privacy policy must be reachable inside the app.
const hasPrivacyLink = /privacy-policy/.test(allSource)
blocker("both", "policy.privacyLink", hasPrivacyLink,
  "Privacy Policy reachable in-app", hasPrivacyLink ? "found in menu" : "MISSING")
const hasTermsLink = /terms-and-conditions/.test(allSource)
blocker("both", "policy.termsLink", hasTermsLink,
  "Terms reachable in-app", hasTermsLink ? "found in menu" : "MISSING")

// Apple 5.1.1(v) again: account creation must not be forced to browse.
const tabsBrowsableAnonymously = existsSync(join(appDir, "(tabs)", "index.tsx"))
blocker("both", "policy.guestBrowse", tabsBrowsableAnonymously,
  "Catalogue is browsable without an account (Apple 5.1.1)", "")

// Apple 4.2: needs more than a repackaged website.
const nativeScreens = routeNames.filter((r) => !/^_/.test(r)).length
blocker("both", "policy.minimumFunctionality", nativeScreens >= 15,
  "Enough native screens to clear 'minimum functionality' (4.2)", `${nativeScreens} screens`)

// Account deletion + sign-in must be reachable without a dead end.
const hasAuthRecovery = routeNames.includes("forgot-password") && routeNames.includes("reset-password")
blocker("both", "policy.authRecovery", hasAuthRecovery,
  "Password recovery exists (reviewers test the forgotten-password path)", "")

// --- runtime robustness -------------------------------------------------
const hasErrorBoundary = /ErrorBoundary|componentDidCatch|\+not-found/.test(allSource) || exists("app/+not-found.tsx")
warn("both", "runtime.notFound", exists("app/+not-found.tsx"),
  "Has a +not-found route so a bad deep link can't white-screen", "")
warn("both", "runtime.errorBoundary", hasErrorBoundary,
  "Has an error boundary / not-found handler", "")

const hasSentry = Boolean(pkg.dependencies?.["@sentry/react-native"] || pkg.dependencies?.["expo-error-recovery"])
warn("both", "runtime.crashReporting", hasSentry,
  "Crash reporting installed (not required, but you fly blind without it)", "")

// Google Play requires an in-app way to reach support.
const hasSupportRoute = routeNames.includes("contact")
blocker("both", "policy.support", hasSupportRoute, "In-app support/contact route exists", "")

// --- secrets ------------------------------------------------------------
const envLeak = /sk_live|rzp_live_[A-Za-z0-9]|SECRET\s*=\s*["'][^"']{8,}/.test(allSource)
blocker("both", "security.noSecrets", !envLeak,
  "No live keys or secrets hardcoded in app source", envLeak ? "POSSIBLE LEAK" : "clean")

const srcDir = join(MOBILE, "src")
const srcSource = existsSync(srcDir) ? walk(srcDir).map((f) => readFileSync(f, "utf8")).join("\n") : ""
const httpInProd = /["']http:\/\/(?!localhost|127\.0\.0\.1)/.test(srcSource + allSource)
blocker("both", "security.noCleartext", !httpInProd,
  "No cleartext http:// endpoints outside localhost (ATS / Play cleartext policy)",
  httpInProd ? "found http:// URL" : "clean")

// ---------------------------------------------------------------- runtime
// Optional: pass a deployed base URL to verify the deep-link association files.
// Universal Links / App Links silently fail without these, and Apple tests them.
const baseUrl = process.argv[2]
if (baseUrl) {
  const checks = [
    ["/.well-known/apple-app-site-association", "ios", "links.aasa", "Apple App Site Association served"],
    ["/.well-known/assetlinks.json", "android", "links.assetlinks", "Android assetlinks.json served"],
  ]
  for (const [path, store, id, title] of checks) {
    try {
      const res = await fetch(baseUrl.replace(/\/$/, "") + path)
      const text = await res.text()
      const ok = res.ok && !/not configured/.test(text)
      blocker(store, id, ok, title, `${res.status}${/not configured/.test(text) ? " — env vars unset" : ""}`)
    } catch (e) {
      blocker(store, id, false, title, `unreachable: ${e.message}`)
    }
  }
}

// ---------------------------------------------------------------- report
const pad = (s, n) => String(s).padEnd(n)
const blockers = results.filter((r) => r.level === "BLOCKER")
const warns = results.filter((r) => r.level === "WARN")
const failedBlockers = blockers.filter((r) => !r.ok)
const failedWarns = warns.filter((r) => !r.ok)

console.log("\n  STORE READINESS AUDIT — Sara Electronics mobile\n")
for (const group of ["both", "ios", "android"]) {
  const rows = results.filter((r) => r.store === group)
  if (!rows.length) continue
  console.log(`  ${group === "both" ? "BOTH STORES" : group === "ios" ? "APP STORE" : "GOOGLE PLAY"}`)
  for (const r of rows) {
    const mark = r.ok ? "PASS" : r.level === "BLOCKER" ? "FAIL" : "warn"
    console.log(`    ${pad(mark, 5)} ${pad(r.title, 62)} ${r.detail}`)
  }
  console.log("")
}

console.log(`  ${blockers.length - failedBlockers.length}/${blockers.length} blockers pass, ${warns.length - failedWarns.length}/${warns.length} warnings pass`)

if (failedBlockers.length) {
  console.log("\n  MUST FIX BEFORE SUBMISSION:")
  for (const r of failedBlockers) console.log(`    - [${r.store}] ${r.title} (${r.detail})`)
}
if (failedWarns.length) {
  console.log("\n  SHOULD FIX:")
  for (const r of failedWarns) console.log(`    - [${r.store}] ${r.title} (${r.detail})`)
}
console.log("")

process.exit(failedBlockers.length ? 1 : 0)
