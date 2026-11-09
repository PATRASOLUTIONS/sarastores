/** Choose one Google installation; a direct Google tag does not need a GTM publish. */
export function googleTagMode(env: {
  NEXT_PUBLIC_GOOGLE_TAG_MODE?: string
  NEXT_PUBLIC_GA_ID?: string
  NEXT_PUBLIC_GTM_ID?: string
}): "direct" | "gtm" | "none" {
  const mode = env.NEXT_PUBLIC_GOOGLE_TAG_MODE?.trim()
  const ga = /^G-[A-Z0-9]+$/.test(env.NEXT_PUBLIC_GA_ID || "")
  const gtm = /^GTM-[A-Z0-9]+$/.test(env.NEXT_PUBLIC_GTM_ID || "")
  if (mode && !["direct", "gtm"].includes(mode)) return "none"
  if (mode === "gtm") return gtm ? "gtm" : "none"
  if (mode === "direct") return ga ? "direct" : "none"
  return ga ? "direct" : gtm ? "gtm" : "none"
}
