import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"

const product = { id: "fixture", name: "Synthetic TV", price: 23456, mrp: 34567, stock: 5, active: true, image: "/fixture.png" }
const link = ({ children, ...props }) => createElement("a", props, children)
function cardLoader() {
  return sourceLoader({
    "next/link": link,
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/hooks/useCart": { useCart: () => ({ addToCart() {} }) },
    "@/hooks/useWishlist": { useWishlist: () => ({ isInWishlist: () => false, addToWishlist() {}, removeFromWishlist() {} }) },
    "@/components/CompareProductButton": () => createElement("button", {}, "Compare"),
    "@/components/AddToCartButton": () => createElement("button", {}, "Add"),
    "@/components/EmiCalculator": { EmiFromBadge: ({ price }) => createElement("span", {}, `EMI ₹${price}`) },
    "@/hooks/useMarketingContent": { useMarketingContent: () => ({ text: () => "Fixture", enabled: () => false }) },
    "@/hooks/useBrandImages": { useBrandImages: () => ({}) },
    "./homepage.module.css": {},
  })
}
for (const kind of ["category", "listing grid", "listing list", "home"]) {
  for (const stock of [0, 5]) {
    test(`${kind} card ${stock ? "shows available" : "hides unavailable"} selling price and MRP`, () => {
      const loader = cardLoader()
      const Component = kind === "category" ? loader.load("components/CategoryProductCard.tsx").default
        : kind === "home" ? loader.load("components/home/landing/HomepageSections.tsx").HomeProductCard
        : loader.load("components/products/ProductListingCard.tsx").default
      const html = renderToStaticMarkup(createElement(Component, { product: { ...product, stock }, layout: kind === "listing list" ? "list" : "grid" }))
      if (stock) { assert.match(html, /23,456/); assert.match(html, /34,567/) }
      else {
        assert.doesNotMatch(html, /23,456|34,567|23456|34567|EMI from|% OFF/)
        assert.match(html, /unavailable|Out of stock/)
      }
    })
  }
}
test("display availability hides disabled, discontinued and invalid-price products", () => {
  const { isProductUnavailable } = sourceLoader().load("lib/product-availability.ts")
  for (const change of [{ active: false }, { stock: 0 }, { stock: -1 }, { disabled: true }, { status: "discontinued" }, { inStock: false }, { price: 0 }]) {
    assert.equal(isProductUnavailable({ ...product, ...change }), true)
  }
  assert.equal(isProductUnavailable(product), false)
})

for (const stock of [0, 5]) {
  test(`product page ${stock ? "shows available" : "hides unavailable"} prices in its main section and mobile bar`, () => {
    let index = 0
    const loader = sourceLoader({
      react: {
        useState: initial => {
          const current = index++
          return [current === 0 ? { ...product, stock } : current === 6 ? false : initial, () => {}]
        },
        useEffect() {}, useMemo: callback => callback(), useCallback: callback => callback,
      },
      "next/link": link,
      "next/navigation": { useRouter: () => ({ push() {} }), useParams: () => ({ slug: "fixture" }) },
      "@/components/Header": () => null, "@/components/Footer": () => null,
      "@/components/ProductSpecificationTabs": () => null, "@/components/ProductReviewsSection": () => null,
      "@/components/product/RazorpayOffers": () => null,
      "@/components/marketing/MarketingSections": { MarketingStatus: () => null },
      "@/hooks/useCart": { useCart: () => ({ addToCart() {} }) },
      "@/hooks/useWishlist": { useWishlist: () => ({ isInWishlist: () => false, addToWishlist() {}, removeFromWishlist() {} }) },
      "@/contexts/AuthContext": { useAuth: () => ({ isAuthenticated: false, isLoading: false }) },
      "@/hooks/useSettingsData": { useSettingsData: () => ({ data: {} }) },
      "@/hooks/useRazorpayOffers": { useRazorpayOffers: () => ({ offers: [], isLoading: false }) },
      "@/hooks/useBanners": { useBanners: () => [] },
      "@/hooks/useMarketingContent": { useMarketingContent: () => ({ text: () => "Fixture", enabled: () => false }) },
    })
    const tree = loader.load("app/product/[slug]/page.tsx").default()
    const html = renderToStaticMarkup(tree)
    if (stock) {
      assert.equal(html.match(/23,456/g)?.length, 2, "Main price and mobile-bar price must both be visible")
      assert.match(html, /34,567/)
    } else {
      assert.doesNotMatch(html, /23,456|34,567|23456|34567|% off|% OFF/)
      assert.ok((html.match(/Currently unavailable/g)?.length ?? 0) >= 2)
    }
  })
}
