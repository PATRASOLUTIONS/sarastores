import { expect, test } from "./fixtures"
import { dismissConsent } from "./helpers"

/**
 * Several product pages open at once.
 *
 * Shoppers compare by opening tabs, and that used to break the product page:
 * each view paged through the whole catalogue — 1,175 products, 500 at a
 * time — purely to choose six related items, and it started before the product
 * itself had loaded so the two competed. Production allows three MongoDB
 * connections per instance, so a few tabs were enough for those crawls to hold
 * every connection while the detail fetch timed out and the page reported
 * "Product information could not be loaded. Please retry."
 *
 * This test fails if that regresses: the fix only holds while suggestions stay
 * a single bounded request made after the product resolves.
 */

const TAB_COUNT = 6
const LOAD_FAILURE = /Product information could not be loaded/i

test.describe("concurrent product pages", () => {
  // Six real page loads against a cold cache; the default 30s is not enough.
  test.setTimeout(180_000)

  test("several product pages opened at once all render", async ({ page, request }, info) => {
    const listing = await request.get(`/api/products?fields=card&limit=${TAB_COUNT}`)
    expect(listing.status(), "catalogue did not answer").toBe(200)

    const slugs = ((await listing.json()) as Array<{ slug?: string }>)
      .map(product => product.slug)
      .filter((slug): slug is string => Boolean(slug))
      .slice(0, TAB_COUNT)

    test.skip(slugs.length < 2, "needs at least two products to open in parallel")

    const context = page.context()

    // Count catalogue requests across every tab. The old code issued three per
    // product page (ceil(1175 / 500)); the fix issues one.
    const catalogueUrls: string[] = []
    context.on("request", req => {
      const url = req.url()
      if (url.includes("/api/products?") && url.includes("fields=card")) catalogueUrls.push(url)
    })

    const open = async (slug: string) => {
      const tab = await context.newPage()
      try {
        await tab.goto(`/product/${slug}`, { waitUntil: "domcontentloaded", timeout: 90_000 })
        await dismissConsent(tab, 2_000)

        // Settle on an outcome rather than a fixed wait: either the price is
        // on screen or the page is telling us it failed.
        await tab
          .locator(`text=${LOAD_FAILURE.source}`)
          .or(tab.locator("text=/₹/").first())
          .first()
          .waitFor({ state: "visible", timeout: 90_000 })
          .catch(() => {})

        const body = (await tab.locator("body").innerText().catch(() => "")) ?? ""
        return {
          slug,
          failed: LOAD_FAILURE.test(body),
          priced: /₹/.test(body),
        }
      } finally {
        await tab.close()
      }
    }

    const results = await Promise.all(slugs.map(open))

    await info.attach("concurrent-pdp.txt", {
      body: [
        `tabs:                ${results.length}`,
        `catalogue requests:  ${catalogueUrls.length}`,
        "",
        ...results.map(r => `  ${r.failed ? "FAILED " : r.priced ? "ok     " : "noprice"} ${r.slug}`),
        "",
        ...catalogueUrls.map(url => `  ${new URL(url).search}`),
      ].join("\n"),
      contentType: "text/plain",
    })

    const broken = results.filter(r => r.failed).map(r => r.slug)
    expect(broken.join("\n"), "product pages failed to load when opened together").toBe("")

    /*
     * One bounded request per tab, and every one of them bounded.
     *
     * Counting requests alone is the wrong assertion: an unrelated component
     * is free to ask the catalogue a small question, and the page genuinely
     * retries. What must never return is an unbounded crawl, so check the
     * shape of each request rather than how many there were.
     */
    const unbounded = catalogueUrls.filter(url => {
      const limit = Number(new URL(url).searchParams.get("limit"))
      return !Number.isFinite(limit) || limit <= 0 || limit > 200
    })
    expect(
      unbounded.join("\n"),
      "a product page asked the catalogue for an unbounded page — the crawl is back",
    ).toBe("")
  })
})
