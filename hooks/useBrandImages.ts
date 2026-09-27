"use client"

import { useSettingsData } from "@/hooks/useSettingsData"

/**
 * Brand photography used across the storefront chrome (About hero, footer story
 * band, contact band, store-locator hero, home stores band).
 *
 * Upload real photographs in Admin → Settings → Branding; the bundled SVG
 * illustrations are only placeholders until then.
 */
export function useBrandImages() {
  const { data } = useSettingsData()

  return {
    storefront: data?.storefrontImage || "/images/about-sara-store.png",
    lifestyle: data?.lifestyleImage || "/images/about-sara-family.png",
    landmark: data?.landmarkImage || "/images/about-karnataka.png",
  }
}
