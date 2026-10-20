import { expect, test } from "./fixtures"
import { dismissConsent, settle } from "./helpers"

/**
 * Defects reported from the live site, pinned so they cannot come back.
 */

const LOAD_FAILURE = /Product information could not be loaded/i

test.describe("reported defects", () => {
  test("the homepage opens straight onto the shop, with no launch curtain", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await dismissConsent(page, 2_000)
    await settle(page, 4_000)

    // The curtain was a fixed overlay that also locked body scrolling, so the
    // page underneath could not be reached or read until it was dismissed.
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow)
    expect(overflow, "body scrolling is still locked by an overlay").not.toBe("hidden")

    const body = (await page.locator("body").innerText()) ?? ""
    expect(body).not.toMatch(/grand opening|launching in|enter (the )?store/i)

    // Something from the actual storefront has to be on screen.
    await expect(page.locator("header").first()).toBeVisible()
  })

  test("product pages whose characteristics are a single value still render", async ({ page, request }) => {
    test.setTimeout(120_000)

    /*
     * `characteristics` is the warehouse CHAR DESC column and 659 of 1,175
     * products store it as a plain string rather than a list. The detail
     * schema insisted on an array, so `.parse()` threw and every one of those
     * pages died with "Product information could not be loaded" — including
     * the LG QNED link that was reported.
     *
     * Pick a product exhibiting the shape rather than hard-coding a slug, so
     * the test survives catalogue edits.
     */
    const listing = await request.get("/api/products?limit=400")
    expect(listing.status(), "catalogue did not answer").toBe(200)

    const products = (await listing.json()) as Array<{ slug?: string; characteristics?: unknown }>
    const stringShaped = products.find(
      product => typeof product.characteristics === "string" && product.characteristics.trim() !== "" && product.slug,
    )

    test.skip(!stringShaped, "no product currently stores characteristics as a string")

    await page.goto(`/product/${stringShaped!.slug}`, { waitUntil: "domcontentloaded", timeout: 90_000 })
    await dismissConsent(page, 2_000)
    await page.locator("text=/₹/").first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {})

    const body = (await page.locator("body").innerText()) ?? ""
    expect(body, `/product/${stringShaped!.slug} did not render`).not.toMatch(LOAD_FAILURE)
    expect(body, "no price on the page").toMatch(/₹/)
  })

  test("sidebar filter counts respond to the other selected filters", async ({ page }) => {
    test.setTimeout(180_000)

    await page.goto("/products", { waitUntil: "domcontentloaded", timeout: 90_000 })
    await dismissConsent(page, 2_000)

    // The grid is filled client-side and never reaches networkidle.
    await page
      .locator('a[href^="/product/"]')
      .first()
      .waitFor({ state: "attached", timeout: 60_000 })
      .catch(() => {})

    /*
     * The filter panel is a sidebar on desktop but collapses behind a
     * "Filters" button on a phone, so open it there before reading anything.
     */
    const filterHeading = page.getByRole("heading", { name: "Filter By", exact: true })
    if (!(await filterHeading.isVisible({ timeout: 15_000 }).catch(() => false))) {
      await page.getByRole("button", { name: /filters/i }).first().click()
    }
    await expect(filterHeading).toBeVisible({ timeout: 30_000 })
    /*
     * Counts render as a parenthesised number beside each label. Sections
     * collapse, and Brand ships collapsed, so open one before reading it.
     */
    const readCounts = async (section: string) => {
      const heading = page.getByRole("button", { name: section, exact: true }).first()
      if ((await heading.getAttribute("aria-expanded")) !== "true") {
        await heading.click()
        await page.waitForTimeout(300)
      }
      const body = heading.locator("xpath=following-sibling::div[1]")
      const text = (await body.innerText().catch(() => "")) ?? ""
      return [...text.matchAll(/\((\d+)\)/g)].map(match => Number(match[1]))
    }

    const categoriesBefore = await readCounts("Sub-Category")
    const brandsBefore = await readCounts("Brand")
    expect(categoriesBefore.length, "the Sub-Category filter listed no options").toBeGreaterThan(1)
    expect(brandsBefore.length, "the Brand filter listed no options").toBeGreaterThan(1)

    /*
     * Apply a filter from a *different* dimension. Both of these must move,
     * because the counts now describe what is still reachable rather than
     * what the catalogue happens to hold. Before the fix every count came
     * from the unfiltered set and the two readings were identical.
     */
    await page.locator('label:has-text("In Stock") input[type="checkbox"]').first().check()
    await page.waitForTimeout(1_500)

    const categoriesAfter = await readCounts("Sub-Category")
    const brandsAfter = await readCounts("Brand")

    expect(
      categoriesAfter.join(","),
      "sub-category counts did not change when availability was filtered",
    ).not.toBe(categoriesBefore.join(","))
    expect(
      brandsAfter.join(","),
      "brand counts did not change when availability was filtered",
    ).not.toBe(brandsBefore.join(","))

    // A dimension must not collapse its own counts. Values within one filter
    // are OR-ed, so if picking a brand zeroed the rest, a second brand could
    // never be added.
    await page.locator('label:has-text("In Stock") input[type="checkbox"]').first().uncheck()
    await page.waitForTimeout(500)

    const brandOptions = page
      .getByRole("button", { name: "Brand", exact: true })
      .first()
      .locator('xpath=following-sibling::div[1]//input[@type="checkbox"]')
    await brandOptions.first().check()
    await page.waitForTimeout(1_500)

    const brandsWithOwnSelection = await readCounts("Brand")
    expect(
      brandsWithOwnSelection.filter(count => count > 0).length,
      "selecting one brand zeroed the others, so a second brand could never be added",
    ).toBeGreaterThan(1)
  })
})
