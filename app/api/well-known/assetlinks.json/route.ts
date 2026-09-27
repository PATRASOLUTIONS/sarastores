/**
 * Android Digital Asset Links — served at /.well-known/assetlinks.json via a
 * rewrite in next.config.mjs. Verifies App Links so https:// URLs open in the app.
 *
 * ANDROID_PACKAGE_NAME       e.g. in.sarastores.app
 * ANDROID_SHA256_FINGERPRINTS comma-separated upload + Play signing fingerprints
 */

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean)

  if (!packageName || fingerprints.length === 0) {
    return NextResponse.json(
      { error: "ANDROID_PACKAGE_NAME and ANDROID_SHA256_FINGERPRINTS are not configured" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          // Play App Signing re-signs the upload artifact, so the store build's
          // fingerprint differs from the local one. Both must be listed or
          // links break only in production.
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  )
}
