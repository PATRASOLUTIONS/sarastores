import { expect, test } from "./fixtures"
import { dismissConsent, settle, shoot, watchForProblems } from "./helpers"

/**
 * The header search box is the single most-used control on the storefront.
 * It drives /api/search/suggestions (rate limited, server cached) and then
 * hands off to /products?search=.
 */
test.describe("search", () => {
  test("header search box accepts input and navigates to results", async ({ page }, info) => {
    const problems = watchForProblems(page)
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await dismissConsent(page)
    await settle(page)

    // The header exposes several entry points across breakpoints; take the
    // first visible text input that looks like search.
    const box = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], input[name*="search" i], input[aria-label*="search" i]',
      )
      .filter({ has: undefined })

    const count = await box.count()
    expect(count, "no search input found anywhere in the header").toBeGreaterThan(0)

    let target = null
    for (let i = 0; i < count; i++) {
      const candidate = box.nth(i)
      if (await candidate.isVisible().catch(() => false)) {
        target = candidate
        break
      }
    }

    if (!target) {
      // On mobile the box is behind a toggle. Open it first.
      const toggle = page.getByRole("button", { name: /search/i }).first()
      if (await toggle.isVisible().catch(() => false)) {
        await toggle.click()
        await page.waitForTimeout(500)
        target = box.first()
      }
    }

    expect(target, "search input never became visible").not.toBeNull()

    await target!.click()
    await target!.fill("laptop")
    await page.waitForTimeout(1200) // debounce window for suggestions

    await shoot(page, info, "search-suggestions.png")

    await target!.press("Enter")

    // App Router soft-navigates, so no new document loads: wait on the URL
    // itself rather than a load state.
    await page
      .waitForURL(/\/products|\/search|search=|q=/, { timeout: 25_000 })
      .catch(() => {})
    await settle(page)

    expect(page.url(), "search did not navigate to a results view").toMatch(
      /\/products|\/search|search=|q=/,
    )

    expect(problems.map((p) => `[${p.kind}] ${p.detail}`).join("\n")).toBe("")
  })

  test("suggestions API responds and enforces a minimum query length", async ({ request }) => {
    // Below the minimum the handler must not scan the catalogue. Returning an
    // empty list is as acceptable as refusing outright; what matters is that no
    // suggestions come back.
    const short = await request.get("/api/search/suggestions?q=a")
    if (short.status() < 400) {
      const body = await short.json().catch(() => ({}))
      expect(body.suggestions ?? [], "1-char query returned suggestions").toEqual([])
    }

    const ok = await request.get("/api/search/suggestions?q=lap")
    expect(ok.status(), `suggestions returned ${ok.status()}`).toBe(200)
    const body = await ok.json()
    expect(body, "suggestions payload was empty").toBeTruthy()
  })

  test("results page handles a query with no matches", async ({ page }, info) => {
    await page.goto("/products?search=zzzzqqqqnotathing", { waitUntil: "domcontentloaded" })
    await settle(page)
    const body = (await page.locator("body").innerText().catch(() => "")) ?? ""
    await shoot(page, info, "search-empty.png")
    // Must show an empty state rather than crashing or rendering nothing.
    expect(body.trim().length, "no-match search rendered an empty page").toBeGreaterThan(40)
  })

  test("search input is resistant to script injection", async ({ page }) => {
    const problems = watchForProblems(page)
    let alerted = false
    page.on("dialog", async (d) => {
      alerted = true
      await d.dismiss()
    })

    await page.goto(`/products?search=${encodeURIComponent('<img src=x onerror=alert(1)>')}`, {
      waitUntil: "domcontentloaded",
    })
    await settle(page)

    expect(alerted, "reflected search term executed script").toBe(false)
    expect(problems.filter((p) => p.kind === "pageerror").length).toBe(0)
  })
})
