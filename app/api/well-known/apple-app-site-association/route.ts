/**
 * Apple App Site Association — served at /.well-known/apple-app-site-association
 * via a rewrite in next.config.mjs.
 *
 * This is a route handler rather than a file in public/ because Apple requires
 * `application/json` and refuses the file otherwise; a static file with no
 * extension is served as octet-stream.
 *
 * Set IOS_APP_ID to "<TEAM_ID>.<BUNDLE_ID>" (e.g. ABCDE12345.in.sarastores.app).
 */

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Web paths that should open in the app when it is installed. */
const DEEP_LINK_PATHS = [
  "/product/*",
  "/category/*",
  "/sub-category/*",
  "/brands/*",
  "/offers",
  "/cart",
  "/wishlist",
  "/track",
  "/order/*",
  "/campaign/*",
  "/account/*",
]

export async function GET() {
  const appId = process.env.IOS_APP_ID

  if (!appId) {
    // Deliberately a 404 rather than a placeholder: serving a malformed
    // association file makes universal links fail silently and is far harder
    // to diagnose than an obviously absent one.
    return NextResponse.json(
      { error: "IOS_APP_ID is not configured" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: appId,
            paths: DEEP_LINK_PATHS,
            components: DEEP_LINK_PATHS.map((path) => ({ "/": path, comment: "Deep link into the app" })),
          },
        ],
      },
      webcredentials: { apps: [appId] },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  )
}
