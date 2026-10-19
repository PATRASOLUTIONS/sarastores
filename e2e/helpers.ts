import type { ConsoleMessage, Page, Request, TestInfo } from "@playwright/test"

/** A problem observed in the browser while a page was open. */
export type PageProblem = {
  kind: "console" | "pageerror" | "requestfailed" | "httperror"
  detail: string
}

/**
 * Noise that is expected in local dev and does not indicate a product defect.
 * Kept deliberately narrow so real errors are never swallowed.
 */
const IGNORED = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /react-devtools/i,
  // The dev overlay and HMR websocket are dev-server plumbing.
  /_next\/static\/chunks\/.*\.hot-update/i,
  /webpack-hmr/i,
  // Razorpay is intentionally configured with placeholder test keys locally, so
  // its API rejects us and the bank-offers proxy returns 502. That is an
  // artefact of the test environment, not a product defect — but the storefront
  // must still render, which the rest of each assertion checks.
  /checkout\.razorpay\.com/i,
  /\/api\/razorpay\/offers/i,
  /status of 502 \(Bad Gateway\)/i,
  // Analytics are consent-gated and unmounted until the banner is accepted.
  /vitals\.vercel-insights/i,
]

function ignored(text: string): boolean {
  return IGNORED.some((re) => re.test(text))
}

/**
 * Attach listeners that record browser-side problems for the lifetime of the
 * page. Returns the live array - read it after navigation completes.
 */
export function watchForProblems(page: Page): PageProblem[] {
  const problems: PageProblem[] = []

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return
    const text = msg.text()
    if (ignored(text)) return
    problems.push({ kind: "console", detail: text.slice(0, 400) })
  })

  page.on("pageerror", (err: Error) => {
    if (ignored(err.message)) return
    problems.push({ kind: "pageerror", detail: `${err.name}: ${err.message}`.slice(0, 400) })
  })

  page.on("requestfailed", (req: Request) => {
    const url = req.url()
    if (ignored(url)) return
    const failure = req.failure()?.errorText ?? "unknown"
    // Aborted requests are usually the app cancelling its own in-flight fetches.
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure)) return
    // Third-party asset hosts failing is not a defect in this application. The
    // catalogue does reference images on vendor CDNs that block cross-origin
    // reads, which is tracked separately by the broken-image check rather than
    // failing every page that happens to show one.
    if (!url.startsWith("http://localhost") && req.resourceType() === "image") return
    problems.push({ kind: "requestfailed", detail: `${failure} ${url}`.slice(0, 400) })
  })

  page.on("response", (res) => {
    const status = res.status()
    if (status < 500) return
    if (ignored(res.url())) return
    problems.push({ kind: "httperror", detail: `HTTP ${status} ${res.url()}`.slice(0, 400) })
  })

  return problems
}

/** Settle: wait for the network to go quiet, tolerating pages that never do. */
export async function settle(page: Page, ms = 2500): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: ms })
  } catch {
    // Pages with polling or long-lived connections never reach networkidle.
  }
}

/**
 * Dismiss the DPDP consent banner if present. It overlays the viewport and
 * intercepts clicks, so most interaction tests need it gone first.
 */
export async function dismissConsent(page: Page, timeout = 2_500): Promise<boolean> {
  // The banner mounts only after hydration resolves stored consent, so it can
  // appear well after domcontentloaded. Poll instead of checking once.
  //
  // Callers that only need to clear a banner they just caused to re-open can
  // pass a short timeout; the full poll is for fresh navigations.
  const accept = page.getByRole("button", { name: /accept all|^accept|got it|agree|allow all/i }).first()
  try {
    await accept.waitFor({ state: "visible", timeout })
  } catch {
    return false // No banner — consent was already seeded.
  }
  await accept.click({ timeout: 8_000 }).catch(() => {})
  // Wait for the fixed bar to leave the layer stack; it covers the footer.
  await page
    .locator(".fixed.inset-x-0.bottom-0")
    .first()
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => {})
  return true
}

/**
 * Pre-seed a consent decision so the banner never mounts. Interaction tests
 * need this: the banner is `position: fixed; bottom: 0; z-index: 9998` and
 * covers the footer until it is answered.
 */
export const CONSENT_STORAGE_KEY = "dpdp_tracking_consent"
export const PRIVACY_NOTICE_VERSION =
  process.env.NEXT_PUBLIC_PRIVACY_NOTICE_VERSION || "2026-10-01.1"

export async function seedConsent(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, version]) => {
      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            analytics: false,
            advertising: false,
            personalisation: false,
            version,
            decidedAt: new Date().toISOString(),
            anonymousId: "e2e-anonymous-id",
          }),
        )
      } catch {
        // Storage refusal is handled by the app itself.
      }
    },
    [CONSENT_STORAGE_KEY, PRIVACY_NOTICE_VERSION] as const,
  )
}

/** Save a full-page screenshot as a test attachment. */
export async function shoot(page: Page, info: TestInfo, name: string): Promise<void> {
  try {
    const buf = await page.screenshot({ fullPage: true, timeout: 25_000 })
    await info.attach(name, { body: buf, contentType: "image/png" })
  } catch {
    // A screenshot failure must never fail the assertion under test.
  }
}

/** Public routes that should render for an anonymous visitor. */
export const PUBLIC_ROUTES: Array<{ path: string; label: string }> = [
  { path: "/", label: "home" },
  { path: "/products", label: "catalogue" },
  { path: "/offers", label: "offers" },
  { path: "/brands", label: "brands" },
  { path: "/software", label: "software" },
  { path: "/cart", label: "cart" },
  { path: "/wishlist", label: "wishlist" },
  { path: "/compare", label: "compare" },
  { path: "/checkout", label: "checkout" },
  { path: "/store-locator", label: "store locator" },
  { path: "/stores", label: "stores index" },
  { path: "/track", label: "order tracking" },
  { path: "/login", label: "login" },
  { path: "/register", label: "register" },
  { path: "/forgot-password", label: "forgot password" },
  { path: "/contact", label: "contact" },
  { path: "/complaints", label: "complaints" },
  { path: "/about", label: "about" },
  { path: "/faq", label: "faq" },
  { path: "/emi", label: "emi" },
  { path: "/rewards", label: "rewards" },
  { path: "/spin", label: "spin wheel" },
  { path: "/lucky-draw", label: "lucky draw" },
  { path: "/blog", label: "blog" },
  { path: "/search", label: "search redirect" },
  { path: "/privacy-policy", label: "privacy policy" },
  { path: "/terms-and-conditions", label: "terms" },
  { path: "/shipping-policy", label: "shipping policy" },
  { path: "/cancellation-policy", label: "cancellation policy" },
  { path: "/returns", label: "returns" },
  { path: "/warranty", label: "warranty" },
  { path: "/installation", label: "installation" },
  { path: "/careers", label: "careers" },
  { path: "/press", label: "press" },
  { path: "/business-enquiries", label: "business enquiries" },
  { path: "/corporate-information", label: "corporate info" },
  { path: "/disclaimer", label: "disclaimer" },
  { path: "/credits", label: "credits" },
  { path: "/brand-guidelines", label: "brand guidelines" },
  { path: "/sitemap", label: "sitemap page" },
]

/** Routes that must redirect an anonymous visitor away. */
export const GATED_ROUTES: Array<{ path: string; label: string }> = [
  { path: "/account", label: "account hub" },
  { path: "/account/profile", label: "account profile" },
  { path: "/account/orders", label: "account orders" },
  { path: "/dashboard", label: "dashboard" },
  { path: "/dashboard/orders", label: "dashboard orders" },
  { path: "/admin", label: "admin root" },
  { path: "/admin/products", label: "admin products" },
  { path: "/admin/orders", label: "admin orders" },
  // The vendor portal was the last client-only gate: it used to serve the whole
  // shell and redirect after hydration, so an anonymous visitor could read it
  // by not running the JavaScript.
  { path: "/vendor/dashboard", label: "vendor dashboard" },
  { path: "/vendor/products", label: "vendor products" },
]
