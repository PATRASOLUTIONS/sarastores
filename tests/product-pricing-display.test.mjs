import assert from "node:assert/strict"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"
import { createRequire } from 'node:module'
import config from '../next.config.mjs'

const require = createRequire(import.meta.url)
const { getImgProps } = require('next/dist/shared/lib/get-img-props.js')
const { imageConfigDefault } = require('next/dist/shared/lib/image-config.js')
const defaultLoader = require('next/dist/shared/lib/image-loader.js').default
const optimizedImage = props => createElement('img', getImgProps(props, {
  defaultLoader, imgConf: { ...imageConfigDefault, ...config.images },
}).props)

const product = { id: "fixture", name: "Synthetic TV", price: 23456, mrp: 34567, stock: 5, active: true, image: "/fixture.png" }
const link = ({ children, ...props }) => createElement("a", props, children)
function cardLoader(overrides = {}) {
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
    ...overrides,
  })
}

for (const kind of ['category', 'listing grid', 'listing list', 'home', 'cart']) {
  test(`${kind} product photos are served through the website optimizer`, () => {
    const loader = cardLoader({ 'next/image': { __esModule: true, default: optimizedImage } })
    const photo = 'https://rukmini1.flixcart.com/image/1500/1500/xif0q/mobile/product.jpeg'
    const Component = kind === 'category' ? loader.load('components/CategoryProductCard.tsx').default
      : kind === 'home' ? loader.load('components/home/landing/HomepageSections.tsx').HomeProductCard
      : kind === 'cart' ? loader.load('components/CartProductImage.tsx').default
      : loader.load('components/products/ProductListingCard.tsx').default
    const html = renderToStaticMarkup(createElement(Component, {
      product: { ...product, image: photo }, src: photo, name: product.name,
      layout: kind === 'listing list' ? 'list' : 'grid',
    }))
    assert.match(html, /src="\/_next\/image\?url=https%3A%2F%2Frukmini1\.flixcart\.com/)
    assert.match(html, /srcSet=/)
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
    const loader = sourceLoader({
      react: {
        useState: initial => {
          return [typeof initial === "function" ? initial() : initial, () => {}]
        },
        useEffect() {}, useMemo: callback => callback(), useCallback: callback => callback,
      },
      "next/link": link,
      'next/image': { __esModule: true, default: optimizedImage },
      "next/navigation": { useRouter: () => ({ push() {} }), useParams: () => ({ slug: "fixture" }) },
      "@/components/Header": () => null, "@/components/Footer": () => null,
      "@/components/ProductSpecificationTabs": () => null, "@/components/ProductReviewsSection": () => null,
      "@/components/product/RazorpayOffers": () => null,
      "@/components/marketing/MarketingSections": { MarketingStatus: () => null },
      "@/hooks/useCart": { useCart: () => ({ addToCart() {} }) },
      "@/hooks/useWishlist": { useWishlist: () => ({ isInWishlist: () => false, addToWishlist() {}, removeFromWishlist() {} }) },
      "@/contexts/AuthContext": { useAuth: () => ({ isAuthenticated: false, isLoading: false }) },
      "@/components/product/ProductSaraCare": { __esModule: true, default: () => null,
        useProductSaraCare: () => ({ offer: null, loading: false, selected: null, selectedPlan: null, parent: undefined }) },
      "@/hooks/useSettingsData": { useSettingsData: () => ({ data: {} }) },
      "@/hooks/useRazorpayOffers": { useRazorpayOffers: () => ({ offers: [], isLoading: false }) },
      "@/hooks/useBanners": { useBanners: () => [] },
      "@/hooks/useMarketingContent": { useMarketingContent: () => ({ text: () => "Fixture", enabled: () => false }) },
    })
    const tree = loader.load("app/product/[slug]/ProductDetailClient.tsx").default({ initialProduct: { ...product, stock } })
    const html = renderToStaticMarkup(tree)
    assert.match(html, /src="\/_next\/image\?url=%2Ffixture\.png/)
    assert.match(html, /loading="eager"/)
    if (stock) {
      assert.match(html, /<span class="font-heading text-2xl[^\"]*">₹23,456<\/span>/, "Main price must be visible")
      assert.match(html, /<p class="text-sm font-bold text-gray-900">₹23,456<\/p>/, "Mobile-bar price must be visible")
      assert.match(html, /34,567/)
    } else {
      assert.doesNotMatch(html, /23,456|34,567|23456|34567|% off|% OFF/)
      assert.ok((html.match(/Currently unavailable/g)?.length ?? 0) >= 2)
    }
  })
}
