# SARA Electronics

Next.js App Router storefront and administration application, with a separate Expo mobile project. See [CLAUDE.md](CLAUDE.md) for development conventions; older documents may describe superseded behaviour.

## Project directory map

```text
ecom-sara\
  app\                         Next.js pages, layouts and API routes
  components\                  Shared storefront/admin UI
  contexts\                    Authentication, cart and UI state
  hooks\                       React hooks
  lib\                         Server/domain helpers and validation
    seed-data\                 Internal development seed catalogue, not public assets
  utils\                       Shared utility functions
  types\                       Shared TypeScript declarations
  styles\                      Stylesheets
  public\                      Intentionally public images, fonts and service worker
  mobile\                      Separate Expo application
  tests\                       Local regression tests and isolated fixtures
  scripts\                     Operational commands; run from the repository root
    utilities\                 Offline document-catalogue generator
  documents\                   Internal documentation, guides and related assets
    index.html                 Offline document catalogue
    reports\                   Bug, security and app-store reports
    proposals\                 Sales collateral and associated assets
    design\                    Layout references, screenshots and wireframe PDF
    legacy\                    Superseded CLAUDE guide
    archive\                   Previous UI source and branding; not active code
      tools\diagnostics\       Former root-level inspection/audit tools
      tools\pdf-gen\           Historical wireframe generators
      tools\extract-docx.mjs    Historical DOCX extractor
    private-artifacts\         Sensitive logs/dumps, excluded from catalogue and Git
      audit\                   Historical audit output and order dumps
      archive\                 Browser logs, scraper PDFs/backups and old markers
    *-assets\                  Images belonging to the HTML walkthroughs
    architecture\, features\,  Existing technical/business reference sections
    operations\, partner-api\,
    security\, spin-wheel\,
    analysis\, brand\, brd\,
    abandoned-cart\, whatsapp\
  .github\, .claude\, .vscode\  Development/automation configuration
  .next\, node_modules\        Generated build/dependency folders
```

Framework entry points and configuration stay at the root: `package.json`, `package-lock.json`, `next.config.mjs`, `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `next-env.d.ts`, `middleware.ts`, `instrumentation.ts`, `vercel.json`, `components.json` and the existing `build.sh` entry point. `AGENTS.md` and `CLAUDE.md` also remain there for automatic discovery. Build caches such as `tsconfig.tsbuildinfo` are generated, not documentation to relocate.

## Documentation

Open [the offline document catalogue](documents/index.html), or a specific guide:

- [Marketing campaigns and customer flows](documents/marketing-campaign-guide.html)
- [Poster creation, admin pages and display locations](documents/marketing-poster-guide.html)
- [Customer journey in screenshots](documents/customer-journey.html)
- [Production-readiness audit](documents/production-readiness-audit.md)
- [Customer-journey UI audit](documents/customer-journey-ui-audit.md)
- [Public-access and organisation notes](documents/operations/WORKSPACE_ORGANIZATION.md)

Keep each HTML guide's adjacent asset folder when copying it. Documentation under `documents\` is **not a public website route**. It is excluded from Vercel uploads; do not copy internal reports, proposals, scripts or exports into `public\`.

`public\` assets and the application's declared pages/routes are served intentionally. Moving files to a folder called `documents` alone is not access control on an arbitrary static web server. The live hosted deployment must still be checked separately.

## Commands

```powershell
npm run dev
npx tsc --noEmit
npm test
npm run lint
npm run build
```

Configure required environment values locally and in the hosting platform; never commit or publish them. Do not execute seed/migration/inspection commands against a live database merely to check project organisation. Operational commands and their package-script paths were preserved. Historical diagnostic tools can be invoked as `node documents\archive\tools\diagnostics\<filename>.mjs` from the repository root.

The root is not a production-only bundle: tests, the separate mobile app and active maintenance tools remain in their conventional locations, as requested. They are useful development/operations source, not website runtime dependencies. `scripts\assign-missing-licenses.ts` **is** imported by an admin API and must remain deployable. Vercel excludes `documents\`, `tests\`, `mobile\`, local outputs and secrets; Next's build traces select the runtime dependencies. Editor/agent configuration and active caches were not archived merely because the browser does not use them.
