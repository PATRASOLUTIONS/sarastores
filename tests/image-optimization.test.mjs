import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import config from "../next.config.mjs"
import { canOptimizeImage, remoteImagePatterns } from "../lib/image-sources.mjs"
import { sourceLoader } from "./source-loader.mjs"

const require = createRequire(import.meta.url)
const { matchRemotePattern } = require("next/dist/shared/lib/match-remote-pattern.js")

test("image components use the same allowlist as the Next optimizer", () => {
  assert.equal(config.images.remotePatterns, remoteImagePatterns)
  assert.equal(remoteImagePatterns.some(pattern => pattern.hostname === "**"), false)
  for (const pattern of remoteImagePatterns) {
    const domain = pattern.hostname.replace("**.", "")
    for (const hostname of [domain, `cdn.${domain}`, `nested.cdn.${domain}`, `${domain}.untrusted.example`]) {
      const pathname = pattern.pathname ? pattern.pathname.replace("**", "banner.jpg") : "/banner.jpg"
      const source = `https://${hostname}${pathname}`
      const allowed = remoteImagePatterns.some(rule => matchRemotePattern(rule, new URL(source)))
      assert.equal(canOptimizeImage(source), allowed, source)
    }
  }
})

test("protected media, SVGs and unsupported suppliers retain direct loading", () => {
  assert.equal(canOptimizeImage("/homepage/poster.webp"), true)
  for (const source of ["/api/media/poster.webp", "/public/../api/media.jpg", "/%61pi/media.jpg", "/logo.svg", "/logo.%73vg", "/logo.svg?version=2", "data:image/png;base64,AA==", "blob:synthetic-image", "https://unconfigured.example/poster.jpg", "https://www.lg.com/logo.svg?version=2", "https://electronicparadise.in/private/photo.jpg", "https://www.lg.com.untrusted.example/photo.jpg", "https://user:password@www.lg.com/photo.jpg"]) {
    assert.equal(canOptimizeImage(source), false, source)
  }
})

test("responsive sizing respects CSS breakpoints and preserves natural-size images", () => {
  const { imageSizes, imageDimension } = sourceLoader().load("lib/image-sizing.ts")
  assert.equal(imageSizes({ className: "w-16 h-16" }), "64px")
  assert.equal(imageSizes({ className: "w-full md:w-1/2 lg:w-96" }), "(min-width: 1024px) 384px, (min-width: 768px) 50vw, 100vw")
  assert.equal(imageSizes({ className: "max-h-40 max-w-full object-contain" }), undefined)
  assert.equal(imageSizes({ className: "h-40 object-contain" }), "100vw")
  assert.equal(imageSizes({ width: "320" }), "320px")
  assert.equal(imageSizes({ className: "w-full", sizes: "50vw" }), "50vw")
  assert.equal(imageDimension("100%"), undefined)
  assert.equal(imageDimension(-1), undefined)
})

function siteHarness() {
  let state
  const React = require("react")
  return sourceLoader({
    react: { ...React, useState: () => [state, value => { state = value }] },
    "@/lib/image-sources.mjs": { canOptimizeImage },
  }).load("components/SiteImage.tsx").default
}

test("site images preserve native geometry, hero loading and protected previews", () => {
  const Image = siteHarness()
  const props = { src: "https://www.lg.com/photo.jpg", alt: "Product" }
  assert.equal(Image(props).props.unoptimized, true, "natural pixels must retain their intrinsic dimensions")
  const hero = Image({ ...props, className: "w-full aspect-video", fetchPriority: "high" }).props
  assert.equal(hero.unoptimized, false)
  assert.equal(hero.loading, "eager")
  assert.equal(hero["data-site-auto-ratio"], "")
  assert.equal(hero.style, undefined, "inline aspect ratio must not override existing CSS")
  const ref = { current: null }
  const fixed = Image({ ...props, width: 320, height: 160, ref }).props
  assert.equal(fixed["data-site-auto-width"], undefined)
  assert.equal(fixed["data-site-auto-ratio"], undefined)
  assert.equal(fixed.width, 320)
  assert.equal(fixed.ref, ref)
  assert.equal(Image({ ...props, className: "w-full", src: "/api/photos/private.jpg" }).props.unoptimized, true)
  assert.equal(Image({ ...props, className: "w-full", unoptimized: true }).props.unoptimized, true)
})

test("imperative image fallbacks clear srcset and recover when the source changes", () => {
  const Image = siteHarness()
  let calls = 0
  const props = { src: "https://www.lg.com/photo.jpg", alt: "Product", className: "w-16", onError: event => { calls++; event.currentTarget.src = "/placeholder.svg" } }
  const attributes = new Map([["src", "/_next/image?url=fixture"], ["srcset", "fixture 640w"]])
  const element = {
    getAttribute: key => attributes.get(key), removeAttribute: key => attributes.delete(key),
    set src(value) { attributes.set("src", value) },
  }
  Image(props).props.onError({ currentTarget: element })
  assert.equal(attributes.has("srcset"), false)
  let rendered = Image(props).props
  assert.equal(rendered.src, "/placeholder.svg")
  assert.equal(rendered.unoptimized, true)
  rendered.onError({ currentTarget: element })
  assert.equal(calls, 1)
  rendered = Image({ ...props, src: "https://www.lg.com/new-photo.jpg" }).props
  assert.equal(rendered.src, "https://www.lg.com/new-photo.jpg")
  assert.equal(rendered.unoptimized, false)
})

test("state-only error handlers keep their own hide or loading behavior", () => {
  const Image = siteHarness()
  let failed = false
  const props = { src: "https://www.lg.com/photo.jpg", alt: "Product", className: "w-16", onError: () => { failed = true } }
  Image(props).props.onError({ currentTarget: { getAttribute: () => props.src } })
  assert.equal(failed, true)
  assert.equal(Image(props).props.src, props.src)
})

test("banner fallback does not replace the next uploaded image", () => {
  const React = require("react")
  let failed
  const loader = sourceLoader({
    react: { ...React, useState: () => [failed, value => { failed = value }] },
    "@/lib/image-sources.mjs": { canOptimizeImage },
  })
  const Banner = loader.load("components/ResponsiveBannerImage.tsx").default
  const first = { src: "https://www.lg.com/poster.jpg", alt: "Offer", sizes: "100vw" }
  let image = Banner(first)
  assert.equal(image.props.src, first.src)
  assert.equal(image.props.unoptimized, false)
  image.props.onError()
  image = Banner(first)
  assert.equal(image.props.src, "/placeholder.svg")
  assert.equal(image.props.unoptimized, true)
  const replacement = { ...first, src: "https://other-supplier.example/poster.jpg" }
  image = Banner(replacement)
  assert.equal(image.props.src, replacement.src)
  assert.equal(image.props.unoptimized, true)
})
