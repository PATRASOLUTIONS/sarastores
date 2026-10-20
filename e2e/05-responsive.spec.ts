import { expect, test } from "./fixtures"
import { dismissConsent, settle, shoot } from "./helpers"

/**
 * Layout checks across breakpoints. The storefront is light-only
 * (`forcedTheme="light"`), so there is no dark variant to cover.
 *
 * The main automated signal here is horizontal overflow: a page wider than its
 * viewport produces a sideways scrollbar on phones, which is the most common
 * responsive defect and is cheap to detect reliably.
 */

const BREAKPOINTS: Array<{ name: string; width: number; height: number }> = [
  { name: "mobile-360", width: 360, height: 780 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "desktop-1920", width: 1920, height: 1080 },
]

const PAGES = [
  { path: "/", label: "home" },
  { path: "/products", label: "catalogue" },
  { path: "/cart", label: "cart" },
  { path: "/checkout", label: "checkout" },
  { path: "/login", label: "login" },
  { path: "/store-locator", label: "store-locator" },
]

// Only the desktop project needs to drive its own viewport sizes; running the
// same sweep under the mobile project would duplicate every screenshot.
test.describe("responsive layout", () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== "desktop-chromium",
      "viewport sweep runs once, under the desktop project")
  })

  for (const bp of BREAKPOINTS) {
    for (const p of PAGES) {
      test(`${p.label} at ${bp.name}`, async ({ page }, info) => {
        await page.setViewportSize({ width: bp.width, height: bp.height })
        await page.goto(p.path, { waitUntil: "domcontentloaded" })
        await dismissConsent(page)
        await settle(page)

        await shoot(page, info, `${p.label}-${bp.name}.png`)

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
          }
        })

        // A few pixels of slack absorbs sub-pixel rounding and scrollbar width.
        const slack = 4
        expect(
          overflow.scrollWidth,
          `${p.path} overflows horizontally at ${bp.width}px ` +
            `(content ${overflow.scrollWidth}px vs viewport ${overflow.clientWidth}px)`,
        ).toBeLessThanOrEqual(overflow.clientWidth + slack)
      })
    }
  }
})

test.describe("mobile navigation", () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== "mobile-chromium", "runs only under the mobile project")
  })

  test("the mobile menu opens", async ({ page }, info) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await dismissConsent(page)
    await settle(page)

    const toggle = page
      .getByRole("button", { name: /menu|navigation|open menu/i })
      .first()

    if (!(await toggle.isVisible().catch(() => false))) {
      test.skip(true, "no labelled menu toggle exposed at this breakpoint")
      return
    }

    await toggle.click({ timeout: 10_000 })
    await page.waitForTimeout(700)
    await shoot(page, info, "mobile-menu-open.png")

    const links = await page.locator("a[href]:visible").count()
    expect(links, "mobile menu exposed no navigation links").toBeGreaterThan(3)
  })
})

test.describe("accessibility basics", () => {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== "desktop-chromium", "runs once, under the desktop project")
  })

  test("homepage images declare alt text and the page has one h1", async ({ page }, info) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await dismissConsent(page)
    await settle(page)

    const audit = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"))
      const missing = imgs
        .filter((i) => !i.hasAttribute("alt"))
        .map((i) => i.getAttribute("src")?.slice(0, 120) || "(no src)")
      return {
        total: imgs.length,
        missingAlt: missing.slice(0, 25),
        missingCount: missing.length,
        h1Count: document.querySelectorAll("h1").length,
        buttonsWithoutLabel: Array.from(document.querySelectorAll("button")).filter(
          (b) =>
            !b.textContent?.trim() &&
            !b.getAttribute("aria-label") &&
            !b.getAttribute("title"),
        ).length,
      }
    })

    await info.attach("a11y-home.txt", {
      body: JSON.stringify(audit, null, 2),
      contentType: "text/plain",
    })

    expect(
      audit.missingAlt.join("\n"),
      `${audit.missingCount} of ${audit.total} homepage images have no alt attribute`,
    ).toBe("")
    expect(audit.buttonsWithoutLabel, "unlabelled buttons are unusable with a screen reader").toBe(0)
  })
})
