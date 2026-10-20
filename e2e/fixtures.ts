import { test as base } from "@playwright/test"
import { seedConsent } from "./helpers"

/**
 * Base test for every spec. It pre-answers the DPDP consent banner, which is a
 * full-width fixed bar at z-index 9998 that covers the footer of every page
 * until a choice is made. Without this, footer controls are unclickable and
 * every interaction sweep reports false failures.
 *
 * The banner's own behaviour is covered separately in 06-consent.spec.ts,
 * which opts out of the seed.
 */
export const test = base.extend<{ consentSeeded: void }>({
  consentSeeded: [
    async ({ page }, use) => {
      await seedConsent(page)
      await use()
    },
    { auto: true },
  ],
})

export { expect } from "@playwright/test"
