import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"
import { dismissConsent, settle, shoot, watchForProblems } from "./helpers"

/**
 * Exhaustive control sweep: enumerate every visible button on a page, click it,
 * and record anything that throws, 5xxs, or blanks the page.
 *
 * Buttons that would leave the page or destroy state are skipped by label so a
 * single sweep can cover the whole control surface without derailing.
 */

const SKIP_LABEL =
  /^(log ?out|sign ?out|delete|remove account|clear all|pay now|place order|proceed to pay|download|print)$/i

/** Pages whose interactive surface is worth sweeping as an anonymous visitor. */
const SWEEP_PAGES: Array<{ path: string; label: string; max: number }> = [
  { path: "/", label: "home", max: 40 },
  { path: "/products", label: "catalogue", max: 40 },
  { path: "/cart", label: "cart", max: 15 },
  { path: "/wishlist", label: "wishlist", max: 15 },
  { path: "/compare", label: "compare", max: 15 },
  { path: "/offers", label: "offers", max: 20 },
  { path: "/brands", label: "brands", max: 20 },
  { path: "/store-locator", label: "store locator", max: 20 },
  { path: "/track", label: "tracking", max: 10 },
  { path: "/contact", label: "contact", max: 12 },
  { path: "/faq", label: "faq", max: 25 },
  { path: "/login", label: "login", max: 12 },
  { path: "/register", label: "register", max: 12 },
]

type ButtonFailure = { label: string; reason: string }

/**
 * Click a control, nudging the page once if a fixed overlay is on top of it.
 *
 * The sweep creates its own obstacles: clicking five "Compare" buttons summons
 * the floating compare widget, which is `fixed bottom-6 right-6`, and on a
 * 412px viewport that then sits over a later control. A real shopper scrolls a
 * little and taps, so the sweep does the same before calling anything broken.
 * A control still unreachable after the nudge is reported as a genuine
 * interception.
 */
async function clickPastOverlays(page: Page, button: ReturnType<Page["locator"]>) {
  try {
    await button.click({ timeout: 4000, noWaitAfter: true })
    return
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!/intercepts pointer events|Timeout .* exceeded/i.test(message)) throw err
  }

  // A drawer opened by an earlier click covers the whole viewport, so scrolling
  // cannot help; it has to be closed first.
  await closeAnyDialog(page)

  // Move the control off the bottom-right corner where the widgets live.
  await page.mouse.wheel(0, -140)
  await page.waitForTimeout(150)
  await button.click({ timeout: 6000, noWaitAfter: true })
}

/**
 * Close a drawer or modal the sweep just opened.
 *
 * "Add to Cart" slides the cart sidebar in, and it covers everything below it
 * until dismissed. The drawer opens only once its request resolves, so a blind
 * Escape can fire before it is even mounted; wait for the dialog, then close it
 * and wait for it to actually go away.
 */
async function closeAnyDialog(page: Page) {
  const dialog = page.locator('[role="dialog"]')
  if (!(await dialog.first().isVisible({ timeout: 600 }).catch(() => false))) {
    // Nothing open yet, but a pending request may still open one.
    await page.waitForTimeout(200)
    if (!(await dialog.first().isVisible({ timeout: 400 }).catch(() => false))) return
  }

  await page.keyboard.press("Escape").catch(() => {})
  if (await dialog.first().isHidden({ timeout: 800 }).catch(() => false)) return

  // Esc is wired through a context listener that a focused input can swallow,
  // so fall back to the dialog's own close control.
  await page
    .getByRole("button", { name: /close/i })
    .first()
    .click({ timeout: 1000, noWaitAfter: true })
    .catch(() => {})
  await dialog.first().waitFor({ state: "hidden", timeout: 1500 }).catch(() => {})
}

/**
 * Name whatever is actually on top of a control, so a failure says which
 * element to go and look at instead of just "an overlay".
 */
async function describeBlocker(button: ReturnType<Page["locator"]>): Promise<string> {
  return (
    (await button
      .evaluate((el) => {
        const r = el.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (!top || el.contains(top) || top.contains(el)) return "nothing on top at click time"
        const cls = typeof top.className === "string" ? top.className.trim().split(/\s+/).slice(0, 6).join(" ") : ""
        return `${top.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ""}`
      })
      .catch(() => "unknown")) ?? "unknown"
  )
}

async function sweepButtons(
  page: Page,
  path: string,
  max: number,
): Promise<{ clicked: number; skipped: number; failures: ButtonFailure[] }> {
  const failures: ButtonFailure[] = []
  let clicked = 0
  let skipped = 0

  const total = Math.min(await page.locator("button:visible").count(), max)

  for (let i = 0; i < total; i++) {
    // Re-query each iteration: a prior click may have re-rendered the tree.
    const button = page.locator("button:visible").nth(i)

    let label = ""
    try {
      label = ((await button.innerText({ timeout: 2000 })) || "").trim().replace(/\s+/g, " ")
      if (!label) label = (await button.getAttribute("aria-label")) || ""
      if (!label) label = (await button.getAttribute("title")) || `button[${i}]`
    } catch {
      skipped++
      continue
    }

    const short = label.slice(0, 60)
    if (SKIP_LABEL.test(label.trim())) {
      skipped++
      continue
    }

    const before = page.url()
    try {
      if (!(await button.isEnabled({ timeout: 1500 }))) {
        skipped++
        continue
      }
      // Centre the control rather than just bringing it on-screen.
      // scrollIntoViewIfNeeded is a no-op once an element is inside the
      // viewport, even when a bottom-anchored floating widget is sitting on
      // top of it, which makes a reachable control look unclickable.
      await button
        .evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }))
        .catch(() => {})
      await page.waitForTimeout(120)
      await clickPastOverlays(page, button)
      clicked++
      await page.waitForTimeout(450)

      // Let a navigation finish before judging the result. A control that
      // correctly routes elsewhere — /brands "Search" goes to /products — is
      // still painting its destination 450ms in, and reading the body then
      // reports a blank page for a button that did exactly the right thing.
      const navigated = page.url() !== before
      if (navigated) await settle(page, 2500)

      // A click must never blank the page or trip the error boundary.
      const crashed = await page
        .locator("text=/Application error: a client-side exception/i")
        .count()
      if (crashed > 0) {
        failures.push({ label: short, reason: "client-side exception after click" })
      }

      const body = (await page.locator("body").innerText().catch(() => "")) ?? ""
      if (body.trim().length < 40) {
        failures.push({
          label: short,
          reason: navigated
            ? `navigated to ${new URL(page.url()).pathname} and that page rendered empty`
            : "page body became empty after click",
        })
      }

      // Return to the sweep page if the click navigated away.
      if (navigated) {
        await page.goto(path, { waitUntil: "domcontentloaded" })
        await dismissConsent(page)
        await settle(page, 1500)
      } else {
        // Close any modal/drawer the click opened so the next button is reachable.
        await closeAnyDialog(page)
        // "Cookie Preferences" in the footer deliberately re-opens the consent
        // bar, which then sits over every control below the fold. Answering it
        // again keeps the sweep from blocking itself on its own earlier click.
        // Short timeout: the banner is either already up or not coming.
        await dismissConsent(page, 300)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      // A control that navigated or re-rendered is gone by the time the click
      // retries, which is not a defect. Confirm the element is still present
      // and visible before calling it unclickable.
      const stillThere = await button
        .isVisible({ timeout: 1000 })
        .catch(() => false)

      if (/intercepts pointer events/i.test(message)) {
        // An overlay covering the control is a genuine usability defect.
        const blocker = await describeBlocker(button)
        failures.push({ label: short, reason: `covered by ${blocker}: ${message.split("\n")[0]}` })
      } else if (stillThere && /Timeout .* exceeded/i.test(message)) {
        // Visible, still mounted, and still refused the click.
        failures.push({ label: short, reason: `not clickable: ${message.split("\n")[0]}` })
      } else if (!/Timeout .* exceeded/i.test(message)) {
        failures.push({ label: short, reason: message.split("\n")[0].slice(0, 180) })
      } else {
        skipped++
      }
      // Recover the page state before continuing.
      await page.goto(path, { waitUntil: "domcontentloaded" }).catch(() => {})
      await dismissConsent(page)
      await settle(page, 1500)
    }
  }

  return { clicked, skipped, failures }
}

test.describe("button sweep", () => {
  for (const { path, label, max } of SWEEP_PAGES) {
    test(`${label} (${path}) controls respond`, async ({ page }, info) => {
      const problems = watchForProblems(page)

      await page.goto(path, { waitUntil: "domcontentloaded" })
      await dismissConsent(page)
      await settle(page)

      const { clicked, skipped, failures } = await sweepButtons(page, path, max)

      await info.attach(`${label}-sweep.txt`, {
        body: [
          `page:     ${path}`,
          `clicked:  ${clicked}`,
          `skipped:  ${skipped}`,
          `failures: ${failures.length}`,
          "",
          ...failures.map((f) => `  - "${f.label}" -> ${f.reason}`),
          "",
          "browser problems during sweep:",
          ...problems.map((p) => `  [${p.kind}] ${p.detail}`),
        ].join("\n"),
        contentType: "text/plain",
      })

      if (failures.length) await shoot(page, info, `buttons-${label}.png`)

      expect(clicked, `no clickable buttons found on ${path}`).toBeGreaterThan(0)
      expect(
        failures.map((f) => `"${f.label}" -> ${f.reason}`).join("\n"),
        `${path} had controls that failed`,
      ).toBe("")
    })
  }
})

test.describe("navigation links", () => {
  test("header and footer internal links all resolve", async ({ page, request }, info) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await dismissConsent(page)
    await settle(page)

    const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
      nodes
        .map((n) => (n as HTMLAnchorElement).getAttribute("href") || "")
        .filter((h) => h.startsWith("/") && !h.startsWith("//")),
    )

    const unique = Array.from(new Set(hrefs)).slice(0, 60)
    expect(unique.length, "no internal links found on the homepage").toBeGreaterThan(5)

    const broken: string[] = []
    for (const href of unique) {
      const res = await request.get(href, { maxRedirects: 5 }).catch(() => null)
      if (!res) {
        broken.push(`${href} -> request failed`)
        continue
      }
      if (res.status() >= 400) broken.push(`${href} -> HTTP ${res.status()}`)
    }

    await info.attach("internal-links.txt", {
      body: [`checked ${unique.length} links`, "", ...unique].join("\n"),
      contentType: "text/plain",
    })

    expect(broken.join("\n"), "homepage has broken internal links").toBe("")
  })
})
