import { test, expect, type Page } from "@playwright/test"

/*
 * The admin catalogue screen, exercised as an administrator.
 *
 * Needs a real session, so it is skipped unless E2E_ADMIN_EMAIL and
 * E2E_ADMIN_PASSWORD name an account that exists in the database being tested.
 * Skipping is deliberate: a hardcoded credential here would either be wrong on
 * someone else's database or be a credential committed to the repository.
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL || ""
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || ""

test.describe("admin catalogue", () => {
  test.skip(!EMAIL || !PASSWORD, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run")
  test.skip(({ isMobile }) => !!isMobile, "the admin table is a desktop surface")

  async function signIn(page: Page) {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
    await page.getByLabel(/email/i).first().fill(EMAIL)
    await page.getByLabel(/password/i).first().fill(PASSWORD)
    await page.getByRole("button", { name: /^(sign in|log ?in)$/i }).first().click()
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 })
  }

  test("the products table exposes every merchandising column and sorts on them", async ({ page }) => {
    await signIn(page)
    await page.goto("/admin/products", { waitUntil: "domcontentloaded" })

    // The row count is what tells us the catalogue actually loaded; the header
    // renders either way.
    const rows = page.locator("tbody tr")
    await expect.poll(() => rows.count(), { timeout: 60_000 }).toBeGreaterThan(1)

    for (const column of ["Division", "Category", "Segment", "Brand", "Price", "MRP", "Stock", "Status"]) {
      await expect(page.getByRole("button", { name: column, exact: true }).first()).toBeVisible()
    }

    // The warehouse PROD DESC is not the merchandising category.
    await expect(page.getByRole("button", { name: "Sub-Category", exact: true })).toHaveCount(0)

    // Sorting by price must actually reorder, and must reverse on a second
    // click. Compare the first cell's text rather than parsing currency.
    const firstName = () => rows.first().locator("td").first().innerText()
    const before = await firstName()

    await page.getByRole("button", { name: "Price", exact: true }).first().click()
    await expect.poll(firstName, { timeout: 15_000 }).not.toBe(before)
    const ascending = await firstName()

    await page.getByRole("button", { name: "Price", exact: true }).first().click()
    await expect.poll(firstName, { timeout: 15_000 }).not.toBe(ascending)

    // The sorted column has to say so for anyone not using a mouse.
    const header = page.locator("th").filter({ hasText: /^Price$/ }).first()
    await expect(header).toHaveAttribute("aria-sort", /ascending|descending/)
  })

  test("the metadata panel documents exactly the six columns it reads", async ({ page }) => {
    await signIn(page)
    await page.goto("/admin/products", { waitUntil: "domcontentloaded" })

    await page.getByRole("button", { name: "Update Metadata", exact: true }).first().click()

    const panel = page.locator("text=Required Format (Column Headers)").locator("..")
    await expect(panel).toBeVisible({ timeout: 15_000 })

    for (const column of ["itemno", "Name", "Division", "Category", "Segment", "Brand"]) {
      await expect(panel.getByText(column, { exact: true })).toBeVisible()
    }

    // The warehouse spellings are what the operator must stop using; the sheet
    // accepts them on upload but must not advertise them.
    for (const retired of ["CHAR DESC", "sub-category/PROD DESC", "Manufacturer Name", "Category/Group Name"]) {
      await expect(panel.getByText(retired, { exact: true })).toHaveCount(0)
    }
  })

  test("the downloaded sheet carries the six columns and real catalogue data", async ({ page }) => {
    await signIn(page)
    await page.goto("/admin/products", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Update Metadata", exact: true }).first().click()

    const download = page.waitForEvent("download", { timeout: 120_000 })
    await page.getByRole("button", { name: /download template excel/i }).first().click()
    const file = await download

    expect(file.suggestedFilename()).toMatch(/\.xlsx$/)

    // Read the download as a stream rather than off disk. The browser writes
    // into its own sandboxed filesystem view here, so neither `path()` nor a
    // `saveAs()` destination is readable from this process.
    const chunks: Buffer[] = []
    const stream = await file.createReadStream()
    for await (const chunk of stream) chunks.push(chunk as Buffer)

    const XLSX = await import("xlsx")
    const book = XLSX.read(Buffer.concat(chunks), { type: "buffer" })
    const sheet = book.Sheets[book.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

    expect(rows.length).toBeGreaterThan(0)
    // Read the header row itself: a keyed row omits columns that happen to be
    // blank, so it cannot tell us which columns the sheet declares.
    const [header] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    expect(header).toEqual(["itemno", "Name", "Division", "Category", "Segment", "Brand"])

    // Pre-filled from the database, not an empty template: every row is keyed
    // by a real SKU and at least one carries a name.
    expect(rows.every((row) => String(row.itemno || "").trim() !== "")).toBe(true)
    expect(rows.some((row) => String(row.Name || "").trim() !== "")).toBe(true)
  })
})
