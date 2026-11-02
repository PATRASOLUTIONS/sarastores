# Lint and build check

Date: 2026-11-02. Local source changes; no deployment or database changes.

| Check | Result |
| --- | --- |
| Repository ESLint | PASS: 1,262 files, zero errors and zero warnings; `npm.cmd run lint -- --max-warnings 0` |
| TypeScript | PASS: explicit `npx tsc --noEmit`; strict mode remains enabled |
| Production build | PASS: `npm run build` through the isolated build wrapper, exit 0; 221 static pages |
| SEO regressions | PASS: 56 tests, including four build-guard tests |
| Application regressions | 820/874 pass; the same 54 previously documented failures, with no new failure names |
| Public templates | PASS: all 44 indexable templates in HTTP/metadata, desktop, mobile and JavaScript-disabled browser checks |

Removed unused imports, unused UI helpers and unnecessary bindings. Kept API/callback argument positions, caller-owned image fallbacks and server-side authorization/pricing behavior. Rest destructuring that removes private or immutable fields is retained; intentionally unused boundary arguments have an underscore prefix. The unused-variable rule remains enabled.

Stabilized request and event callbacks, completed dependency arrays, and retained request cancellation. Dialog effects depend on whether the dialog is open, rather than every draft keystroke. Delivery restoration uses an explicit pincode, so a result update does not restart its mount request. Product-specification loading uses one debounced effect rather than duplicate immediate/debounced requests. The brand-filter cleanup keeps the existing array when nothing changes.

Build-only preload scripts now use ES modules. Guarded built-in exports are synchronized for named ES module imports; a synthetic environment-file regression verifies that path. Build TypeScript/ESLint checks remain enabled. The project's root TypeScript configuration is unchanged. Expected Next edge-runtime and synthetic fixture-fallback notices do not indicate a failed build.

ESLint excludes generated Next/SEO build output, the isolated runtime, vendored tools and historical code under `documents/archive/`. Active application code, scripts and tests are still checked. No lint rule was switched off.

Two test renderers now implement `useCallback`; checkout memoization is exercised without removing payment/coupon assertions. Remaining application-suite failures are documented in [the SEO testing report](seo/SEO-TESTING-REPORT.md); build/lint success does not make that suite pass.

Evidence is ignored under `.seo-local/`: `lint-final.json`, `lint-types-final.log`, `build.log`, `build-result.json`, `lint-seo-tests-final.log`, `lint-full-tests-final.log`, `lint-payment-tests.log`, `lint-delivery-test.log`, `lint-public-route-audit.log` and the browser reports. Checks use synthetic fixtures and intercepted/blocked external resources. The owner's 16-link exclusion is unchanged.
