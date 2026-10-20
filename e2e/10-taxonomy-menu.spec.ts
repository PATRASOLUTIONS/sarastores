import { expect, test } from "./fixtures"
import { dismissConsent, settle } from "./helpers"

/**
 * The Division → Category → Segment mega-menu.
 *
 * The tree is derived from however the catalogue happens to be classified, so
 * asserting against live data would only prove whatever was uploaded last.
 * The endpoint is stubbed with a fixed tree instead: this pins the *rendering*
 * contract — tab is a division, column heading is a category, links are
 * segments, and each link narrows the listing — independently of the data.
 *
 * The empty case is covered too, because that is what the site serves until
 * someone uploads a classification, and a blank header would be a regression.
 */

const TAXONOMY = {
  divisions: [
    {
      name: "Electronics",
      count: 120,
      brands: [{ name: "Anker", count: 70 }, { name: "Samsung", count: 50 }],
      categories: [
        {
          name: "Mobile Accessories",
          count: 70,
          segments: [
            { name: "Chargers & Adapters", count: 30 },
            { name: "Power Banks", count: 25 },
            { name: "Cables", count: 15 },
          ],
        },
        {
          name: "Audio Accessories",
          count: 50,
          segments: [
            { name: "Earphone Cases", count: 30 },
            { name: "Headphone Stands", count: 20 },
          ],
        },
      ],
    },
    {
      name: "Home Appliances",
      count: 40,
      brands: [{ name: "LG", count: 40 }],
      categories: [
        { name: "Kitchen", count: 40, segments: [{ name: "Mixers", count: 40 }] },
      ],
    },
  ],
}

test.describe("taxonomy mega-menu", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "the mega-menu is a desktop-only bar")

  test("renders division tabs, category headings and segment links", async ({ page }) => {
    test.setTimeout(120_000)

    await page.route("**/api/taxonomy", route =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TAXONOMY) }),
    )

    await page.goto("/", { waitUntil: "domcontentloaded" })
    await dismissConsent(page, 2_000)
    await settle(page, 4_000)

    const nav = page.getByRole("navigation", { name: "Product categories" })

    // Divisions are the tabs, busiest first.
    const electronics = nav.getByRole("link", { name: "Electronics", exact: true })
    await expect(electronics).toBeVisible({ timeout: 20_000 })
    await expect(nav.getByRole("link", { name: "Home Appliances", exact: true })).toBeVisible()

    // Opening a division reveals its categories as headings, each with its
    // own segments beneath.
    await electronics.hover()

    const chargers = nav.getByRole("link", { name: "Chargers & Adapters", exact: true })
    await expect(chargers).toBeVisible({ timeout: 10_000 })
    await expect(nav.getByRole("link", { name: "Mobile Accessories", exact: true })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Audio Accessories", exact: true })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Earphone Cases", exact: true })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Anker", exact: true })).toBeVisible()
    await expect(nav.getByRole("link", { name: "LG", exact: true })).toBeHidden()

    const ankerQuery = new URLSearchParams(
      ((await nav.getByRole("link", { name: "Anker", exact: true }).getAttribute("href")) ?? "").split("?")[1] ?? "",
    )
    expect(ankerQuery.get("division")).toBe("Electronics")
    expect(ankerQuery.get("brand")).toBe("Anker")

    // A segment link has to carry all three levels, or the listing it opens
    // cannot narrow to that shelf.
    const href = await chargers.getAttribute("href")
    const query = new URLSearchParams((href ?? "").split("?")[1] ?? "")
    expect(query.get("division")).toBe("Electronics")
    expect(query.get("category")).toBe("Mobile Accessories")
    expect(query.get("segment")).toBe("Chargers & Adapters")

    // Segments belong to their own category: hovering a different division
    // must not leave the previous one's links on screen.
    await nav.getByRole("link", { name: "Home Appliances", exact: true }).hover()
    await expect(nav.getByRole("link", { name: "Mixers", exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(nav.getByRole("link", { name: "LG", exact: true })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Anker", exact: true })).toBeHidden()
    await expect(chargers).toBeHidden()
  })

  test("falls back to the existing menu when nothing is classified", async ({ page }) => {
    test.setTimeout(120_000)

    await page.route("**/api/taxonomy", route =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ divisions: [] }) }),
    )

    await page.goto("/", { waitUntil: "domcontentloaded" })
    await dismissConsent(page, 2_000)
    await settle(page, 4_000)

    // An unclassified catalogue must still get a usable category bar rather
    // than an empty strip.
    const nav = page.getByRole("navigation", { name: "Product categories" })
    await expect(nav).toBeVisible({ timeout: 20_000 })
    expect(await nav.getByRole("link").count()).toBeGreaterThan(3)
  })
})
