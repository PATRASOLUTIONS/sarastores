import { expect, test } from "./fixtures"
import { dismissConsent, settle } from "./helpers"

/**
 * Product imagery is tracked on its own because a broken image is a visible
 * commercial problem but should not fail every page-render assertion. Many
 * catalogue rows point at vendor CDNs (lg.com among them) that refuse
 * cross-origin reads, so the failure is in the stored URL, not the page.
 */
const PAGES = [
  { path: "/", label: "home" },
  { path: "/products", label: "catalogue" },
  { path: "/offers", label: "offers" },
]

for (const { path, label } of PAGES) {
  test(`${label} (${path}) images resolve`, async ({ page }, info) => {
    await page.goto(path, { waitUntil: "domcontentloaded" })
    await dismissConsent(page)
    await settle(page)
    // Give lazy-loaded imagery below the fold a chance to request.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2500)

    const broken = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        // naturalWidth 0 on a completed load means the bytes never decoded.
        .filter((img) => img.complete && img.naturalWidth === 0)
        .map((img) => img.currentSrc || img.src)
        .filter(Boolean),
    )

    const total = await page.locator("img").count()

    await info.attach(`${label}-images.txt`, {
      body: [
        `page:   ${path}`,
        `images: ${total}`,
        `broken: ${broken.length}`,
        "",
        ...broken.map((src) => `  - ${src.slice(0, 200)}`),
      ].join("\n"),
      contentType: "text/plain",
    })

    // Group by host so the report names the CDN at fault rather than listing
    // dozens of near-identical URLs.
    const hosts = [...new Set(broken.map((src) => {
      try {
        const url = new URL(src, "http://localhost:3005")
        return url.searchParams.get("url")
          ? new URL(decodeURIComponent(url.searchParams.get("url")!)).host
          : url.host
      } catch {
        return "unparseable"
      }
    }))]

    expect(
      `${broken.length} of ${total} images failed to load${hosts.length ? ` (hosts: ${hosts.join(", ")})` : ""}`,
      "broken product imagery",
    ).toMatch(/^0 of /)
  })
}
