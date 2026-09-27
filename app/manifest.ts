import { MetadataRoute } from "next"

/**
 * PWA web manifest.
 *
 * Icons are generated from public/sara-logo.png by
 * scripts/generate-brand-icons.mjs — re-run it whenever the logo changes.
 * The Next.js MetadataRoute manifest is served at /manifest.webmanifest and is
 * also linkable from metadata.
 *
 * Service worker registration remains OFF by default — see app/layout.tsx
 * for the rationale (auto-unregister + opt-in via NEXT_PUBLIC_ENABLE_PWA_SW).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sara Electronics — Shop Smart, Live Better",
    short_name: "Sara Electronics",
    description:
      "Shop genuine electronics, home appliances, smartphones, TVs and more at best prices with fast delivery across India.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    categories: ["shopping", "lifestyle", "business"],
    lang: "en-IN",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Today's Deals",
        short_name: "Deals",
        description: "View deals of the day",
        url: "/products?deals=true",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Spin & Win",
        short_name: "Spin",
        description: "Spin the wheel for rewards",
        url: "/spin",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "My Orders",
        short_name: "Orders",
        description: "Track your orders",
        url: "/account/orders",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  }
}
