import { expect, test } from "./fixtures"
import { GATED_ROUTES, PUBLIC_ROUTES, settle, shoot, watchForProblems } from "./helpers"

/**
 * Route-level smoke: every public page must render for an anonymous visitor
 * without a server error, a thrown exception, or a 5xx sub-request.
 */
test.describe("public routes render", () => {
  for (const { path, label } of PUBLIC_ROUTES) {
    test(`${label} (${path})`, async ({ page }, info) => {
      const problems = watchForProblems(page)

      const response = await page.goto(path, { waitUntil: "domcontentloaded" })
      expect(response, `no response for ${path}`).not.toBeNull()

      const status = response!.status()
      expect(status, `${path} returned HTTP ${status}`).toBeLessThan(400)

      await settle(page)

      // A rendered page must have a non-trivial body; a blank render usually
      // means a client component threw during hydration.
      const bodyText = (await page.locator("body").innerText().catch(() => "")) ?? ""
      expect(bodyText.trim().length, `${path} rendered an empty body`).toBeGreaterThan(40)

      // Next.js renders its error overlay/boundary text on an unhandled throw.
      await expect(
        page.locator("text=/Application error: a client-side exception/i"),
      ).toHaveCount(0)

      if (problems.length) {
        await shoot(page, info, `problems-${label}.png`)
      }
      expect(
        problems.map((p) => `[${p.kind}] ${p.detail}`).join("\n"),
        `${path} reported browser problems`,
      ).toBe("")
    })
  }
})

/**
 * Privileged areas must not serve content to an anonymous visitor. The admin,
 * account and dashboard layouts all perform a server-side session check.
 */
test.describe("gated routes reject anonymous visitors", () => {
  for (const { path, label } of GATED_ROUTES) {
    test(`${label} (${path}) redirects`, async ({ page }, info) => {
      await page.goto(path, { waitUntil: "domcontentloaded" })
      await settle(page, 4000)

      const finalUrl = new URL(page.url())
      const stillThere = finalUrl.pathname === path

      if (stillThere) {
        // Staying put is only acceptable if nothing privileged was rendered.
        const body = (await page.locator("body").innerText().catch(() => "")) ?? ""
        await shoot(page, info, `gated-${label}.png`)
        expect(
          body,
          `${path} did not redirect and rendered content for an anonymous visitor`,
        ).toMatch(/sign in|log in|login|redirecting/i)
      } else {
        expect(
          finalUrl.pathname,
          `${path} redirected somewhere unexpected`,
        ).toMatch(/^\/(login|register|$)/)
      }
    })
  }
})

/** The machine-readable surfaces should be served and well-formed. */
test.describe("machine-readable routes", () => {
  const specs: Array<[string, RegExp]> = [
    ["/robots.txt", /user-agent/i],
    ["/sitemap.xml", /<urlset|<sitemapindex/i],
    ["/manifest.webmanifest", /"name"|"short_name"/i],
    ["/feed.xml", /<rss|<feed/i],
    ["/llms.txt", /./],
  ]

  for (const [path, expected] of specs) {
    test(`${path}`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status(), `${path} returned ${res.status()}`).toBeLessThan(400)
      const body = await res.text()
      expect(body, `${path} body did not match expected shape`).toMatch(expected)
    })
  }
})
