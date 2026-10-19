import { expect, test } from "@playwright/test"
import { CONSENT_STORAGE_KEY, settle, shoot } from "./helpers"

/**
 * The DPDP consent banner. These tests deliberately import the raw Playwright
 * `test` rather than ./fixtures, because the fixture pre-answers the banner.
 */
test.describe("tracking consent", () => {
  test("the banner appears for a first-time visitor and offers a symmetric choice", async ({
    page,
  }, info) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await settle(page)

    const accept = page.getByRole("button", { name: /accept all/i }).first()
    const reject = page.getByRole("button", { name: /reject all/i }).first()

    await expect(accept, "no Accept control on the consent banner").toBeVisible({ timeout: 10_000 })
    await expect(reject, "no Reject control — DPDP s.6 requires free consent").toBeVisible()

    await shoot(page, info, "consent-banner.png")

    // Reject must be as prominent as Accept: same height, comparable width.
    const a = await accept.boundingBox()
    const r = await reject.boundingBox()
    expect(a && r, "consent buttons have no layout box").toBeTruthy()
    expect(Math.abs(a!.height - r!.height), "Reject is a different size to Accept").toBeLessThanOrEqual(4)
  })

  test("rejecting stores a denial and dismisses the banner", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await settle(page)

    const reject = page.getByRole("button", { name: /reject all/i }).first()
    await reject.waitFor({ state: "visible", timeout: 10_000 })
    await reject.click()
    await page.waitForTimeout(600)

    await expect(reject, "banner stayed up after a decision").toBeHidden()

    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      CONSENT_STORAGE_KEY,
    )
    expect(stored, "no consent record was written").toBeTruthy()
    const record = JSON.parse(stored!)
    expect(record.analytics, "rejecting still enabled analytics").toBe(false)
    expect(record.advertising, "rejecting still enabled advertising").toBe(false)
    expect(record.personalisation, "rejecting still enabled personalisation").toBe(false)
  })

  test("the decision survives a reload", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await settle(page)
    await page.getByRole("button", { name: /accept all/i }).first().click({ timeout: 10_000 })
    await page.waitForTimeout(500)

    await page.reload({ waitUntil: "domcontentloaded" })
    await settle(page)

    await expect(
      page.getByRole("button", { name: /accept all/i }).first(),
      "the banner reappeared after the visitor already decided",
    ).toBeHidden()
  })

  test("the footer reopens the preferences dialog", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await settle(page)
    await page.getByRole("button", { name: /accept all/i }).first().click({ timeout: 10_000 })
    await page.waitForTimeout(600)

    const reopen = page.getByRole("button", { name: /cookie preferences/i }).first()
    await reopen.scrollIntoViewIfNeeded()
    await reopen.click({ timeout: 10_000 })
    await page.waitForTimeout(600)

    await expect(
      page.getByRole("button", { name: /reject all/i }).first(),
      "the footer link did not reopen the consent choice",
    ).toBeVisible()
  })
})
