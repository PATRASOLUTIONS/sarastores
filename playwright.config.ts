import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright configuration for the Sara storefront.
 *
 * Discovered automatically by the "Playwright Test for VSCode" extension, so
 * tests can be run and debugged from the Testing sidebar as well as the CLI.
 *
 * The dev server is expected on port 3005 (`npm run dev:3005`). `reuseExisting`
 * means an already-running server is used rather than spawned twice.
 *
 * Timeouts are deliberately generous: `next dev` compiles each route on first
 * request, and several storefront pages pull the full catalogue, so a cold
 * navigation can legitimately take 30-60s. These values do NOT reflect
 * production latency.
 */

const PORT = Number(process.env.E2E_PORT || 3005)
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  // Dev-mode compilation is the bottleneck; running files serially keeps the
  // Next.js compiler from thrashing on a 2-CPU budget.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  // Reports live outside outputDir. Playwright clears outputDir at the start of
  // every run, so a report nested inside it is liable to be deleted — which is
  // what the "output folder clashes" warning was about.
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e/.report/results.json" }],
    ["html", { outputFolder: "e2e/.report/html", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    screenshot: "only-on-failure",
    video: "off",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev:3005",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
